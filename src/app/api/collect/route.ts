import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  searchTikTokVideos,
  getTikTokTrending,
  fetchTikTokUser,
  fetchTikTokComments,
  isListicleTitle,
} from '@/lib/collectors/tiktok-api';
import { collectKoreanReelsPublic } from '@/lib/collectors/instagram-public';
import { collectReelsByHashtags, fetchUserInfo } from '@/lib/collectors/instagram-api';
import { isExcludedContent } from '@/lib/exclude';
import { getOrFetchCreator } from '@/lib/creators';
import { scorePurchaseIntent, evaluatePass } from '@/lib/comments';
import { classifyVideo, classifyByKeywords } from '@/lib/classifier';
import { classifyThumbnail } from '@/lib/vision';
import {
  RECENCY_WINDOW_DAYS,
  TK_DEADLINE_MS,
  HARD_BUDGET_MS,
  MIN_VIEW_COUNT,
  TIKTOK_TRENDING_COUNT,
  TIKTOK_SEARCH_COUNT,
  TIKTOK_COMMENT_SAMPLE,
  KEYWORD_DELAY_MS,
  TIKTOK_KEYWORDS,
  computeViralScore,
} from '@/lib/collect-config';
import { Platform } from '@prisma/client';

// 수집은 ~60초 걸림 — Vercel/Railway 기본 타임아웃 회피
export const maxDuration = 600;

// 최신성 컷오프 — 이 날짜 이전 업로드된 영상은 모두 스킵 (기준값은 collect-config.ts).
const MIN_PUBLISHED_AT = new Date(Date.now() - RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

// 수집 단계 함수들이 공유하는 상태. results 는 mutable — 각 단계가 직접 갱신한다.
interface CollectResults {
  trendsFound: number;
  videosSearched: number;
  videosCollected: number;
  videosSkipped: number;
  errors: string[];
  partial: boolean; // wall-clock budget 초과로 일부 단계를 조기 종료했는지
}
interface CollectCtx {
  results: CollectResults;
  processedVideoIds: Set<string>;
  elapsedMs: () => number;
}

/**
 * Smart Dropshipping Product Video Collector
 *
 * 전략:
 * 1. Google Trends에서 급상승 상품 키워드 수집
 * 2. 해당 키워드로 YouTube 검색 (최근 48시간, 조회수 높은 것)
 * 3. 드랍쉬핑 특화 키워드 병행 검색
 * 4. 높은 engagement 영상만 저장
 *
 * POST 는 인증 + wall-clock budget 관리 + 세 수집 단계(트렌딩/키워드/IG) 호출만 담당.
 * 각 단계 로직은 아래 collect* 함수로 분리(동작 동일).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: CollectResults = {
    trendsFound: 0,
    videosSearched: 0,
    videosCollected: 0,
    videosSkipped: 0,
    errors: [],
    partial: false,
  };

  // ===== Wall-clock budget =====
  // 종료 주체(Railway 프록시 / Node 서버 / GitHub curl 600s)가 무엇이든
  // 그 전에 우리가 먼저 정상 종료하고 200 partial 을 반환한다.
  // 플랫폼별 deadline 으로 슬롯을 나눠 어느 날이든 세 채널 모두 일부는 수집되게 함.
  const startedAt = Date.now();
  const elapsedMs = () => Date.now() - startedAt;

  try {
    // YouTube 수집 제거 (의뢰인 요청) — TikTok + Instagram 만 수집.
    const ctx: CollectCtx = {
      results,
      processedVideoIds: new Set<string>(),
      elapsedMs,
    };

    // ===== STEP 3: 틱톡 수집 (트렌딩 + 키워드) =====
    console.log('\n🎵 Collecting TikTok videos...');
    let tiktokCollected = await collectTikTokTrending(ctx);
    tiktokCollected += await collectTikTokKeywords(ctx);
    console.log(`🎵 TikTok: collected ${tiktokCollected} videos`);

    // ===== STEP 4: 인스타그램 릴스 수집 =====
    const instagramCollected = await collectInstagram(ctx);

    return NextResponse.json({
      success: true,
      partial: results.partial, // budget 초과로 일부 단계를 조기 종료했어도 성공 응답
      elapsedMs: elapsedMs(),
      results: {
        ...results,
        tiktokCollected,
        instagramCollected,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Collection error:', error);
    return NextResponse.json(
      { error: 'Collection failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * STEP 3a — 틱톡 트렌딩(US). 게이트 통과분을 upsert 하고 수집 건수를 반환.
 * 트렌딩 루프만의 특징: Gemini 분류 시도, skip 시 results.videosSkipped 증가.
 */
async function collectTikTokTrending(ctx: CollectCtx): Promise<number> {
  const { results, processedVideoIds, elapsedMs } = ctx;
  let tiktokCollected = 0;

  try {
    // 틱톡 트렌딩 (US)
    const trendingVideos = await getTikTokTrending({ count: TIKTOK_TRENDING_COUNT });
    console.log(`  Found ${trendingVideos.length} trending TikTok videos`);

    for (const video of trendingVideos) {
      if (elapsedMs() > TK_DEADLINE_MS) {
        console.log(`⏱️ TikTok 트렌딩 budget 초과 — 조기 종료`);
        results.partial = true;
        break;
      }
      if (processedVideoIds.has(video.id)) continue;
      if (video.viewCount < MIN_VIEW_COUNT) continue;
      // 영어 텍스트 필수, 한글이 들어가면 제외
      if (!/[a-zA-Z]{3,}/.test(video.title)) continue;
      if (/[가-힣]/.test(video.title)) continue;

      // 최신성 컷오프 — create_time 없으면 안전하게 skip
      const tkPublished = video.createTime ? new Date(video.createTime * 1000) : null;
      if (!tkPublished || tkPublished < MIN_PUBLISHED_AT) continue;

      // 셀러 검증 게이트
      const tkCreator = await getOrFetchCreator(Platform.TIKTOK, video.authorId, () =>
        fetchTikTokUser(video.authorId),
      );
      const tkComments = await fetchTikTokComments(video.videoUrl, TIKTOK_COMMENT_SAMPLE);
      const tkIntentScore = scorePurchaseIntent(tkComments);
      const { passReason: tkPassReason } = evaluatePass(
        !!tkCreator?.hasSalesLink,
        tkIntentScore,
        video.commentCount,
        video.viewCount,
      );
      if (!tkPassReason) {
        results.videosSkipped++;
        continue;
      }

      // 비전 게이트
      let tkVisualClass: string | null = null;
      if (process.env.GEMINI_API_KEY) {
        tkVisualClass = await classifyThumbnail(process.env.GEMINI_API_KEY, video.thumbnailUrl);
        if (tkVisualClass === 'face') {
          results.videosSkipped++;
          continue;
        }
      }

      processedVideoIds.add(video.id);

      try {
        let classification;
        if (process.env.GEMINI_API_KEY) {
          classification = await classifyVideo(process.env.GEMINI_API_KEY, {
            title: video.title,
            description: video.description,
            authorName: video.authorName,
          });
        } else {
          classification = classifyByKeywords({ title: video.title, description: video.description });
        }

        await prisma.video.upsert({
          where: { videoId: `tiktok_${video.id}` },
          update: {
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            viewCount: BigInt(video.viewCount),
            likeCount: BigInt(video.likeCount),
            commentCount: BigInt(video.commentCount),
            shareCount: BigInt(video.shareCount),
            category: classification.category,
            targetAge: classification.targetAge,
            tags: classification.tags,
            country: 'US',
            publishedAt: tkPublished,
            hasPurchaseIntent: tkPassReason === 'both',
            purchaseIntentScore: tkIntentScore,
            passReason: tkPassReason,
            visualClass: tkVisualClass,
            updatedAt: new Date(),
          },
          create: {
            platform: Platform.TIKTOK,
            videoId: `tiktok_${video.id}`,
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            videoUrl: video.videoUrl,
            authorName: video.authorName,
            authorUrl: `https://www.tiktok.com/@${video.authorId}`,
            viewCount: BigInt(video.viewCount),
            likeCount: BigInt(video.likeCount),
            commentCount: BigInt(video.commentCount),
            shareCount: BigInt(video.shareCount),
            viralScore: computeViralScore(video.viewCount),
            category: classification.category,
            targetAge: classification.targetAge,
            tags: classification.tags,
            country: 'US',
            publishedAt: tkPublished,
            hasPurchaseIntent: tkPassReason === 'both',
            purchaseIntentScore: tkIntentScore,
            passReason: tkPassReason,
            visualClass: tkVisualClass,
          },
        });
        tiktokCollected++;
      } catch (err) {
        console.error('TikTok save error:', err);
      }
    }
  } catch (err) {
    console.error('TikTok trending error:', err);
    results.errors.push('TikTok trending failed');
  }

  return tiktokCollected;
}

/**
 * STEP 3b — 틱톡 키워드 검색 (TIKTOK_KEYWORDS 순회).
 * 트렌딩과 달리: 분류는 항상 keyword, skip 시 videosSkipped 미증가,
 * upsert update 필드가 트렌딩보다 적다(알려진 이슈 — 함부로 통일하면 재수집 동작이 바뀜).
 */
async function collectTikTokKeywords(ctx: CollectCtx): Promise<number> {
  const { results, processedVideoIds, elapsedMs } = ctx;
  let tiktokCollected = 0;

  // 틱톡 키워드 검색 — 키워드 풀은 collect-config.ts (TIKTOK_KEYWORDS).
  for (const kw of TIKTOK_KEYWORDS) {
    // budget: TikTok 슬롯 초과 시 남은 키워드 스킵
    if (elapsedMs() > TK_DEADLINE_MS) {
      console.log(`⏱️ TikTok 키워드 budget 초과 — 남은 키워드 스킵`);
      results.partial = true;
      break;
    }
    try {
      const videos = await searchTikTokVideos(kw, { count: TIKTOK_SEARCH_COUNT });
      for (const video of videos) {
        if (elapsedMs() > TK_DEADLINE_MS) { results.partial = true; break; }
        if (processedVideoIds.has(video.id)) continue;
        if (video.viewCount < MIN_VIEW_COUNT) continue;
        if (!/[a-zA-Z]{3,}/.test(video.title)) continue;
        if (/[가-힣]/.test(video.title)) continue;

        // 최신성 컷오프
        const tkPublished = video.createTime ? new Date(video.createTime * 1000) : null;
        if (!tkPublished || tkPublished < MIN_PUBLISHED_AT) continue;

        // 셀러 검증 게이트 — creator + 댓글 둘 다 확인
        const tkCreator2 = await getOrFetchCreator(Platform.TIKTOK, video.authorId, () =>
          fetchTikTokUser(video.authorId),
        );
        const tkComments2 = await fetchTikTokComments(video.videoUrl, TIKTOK_COMMENT_SAMPLE);
        const tkIntentScore2 = scorePurchaseIntent(tkComments2);
        const { passReason: tkPassReason2 } = evaluatePass(
          !!tkCreator2?.hasSalesLink,
          tkIntentScore2,
          video.commentCount,
          video.viewCount,
        );
        if (!tkPassReason2) continue;

        // 비전 게이트
        let tkVisualClass2: string | null = null;
        if (process.env.GEMINI_API_KEY) {
          tkVisualClass2 = await classifyThumbnail(process.env.GEMINI_API_KEY, video.thumbnailUrl);
          if (tkVisualClass2 === 'face') continue;
        }

        processedVideoIds.add(video.id);

        try {
          const classification = classifyByKeywords({ title: video.title, description: video.description });

          await prisma.video.upsert({
            where: { videoId: `tiktok_${video.id}` },
            update: {
              thumbnailUrl: video.thumbnailUrl,
              viewCount: BigInt(video.viewCount),
              likeCount: BigInt(video.likeCount),
              publishedAt: tkPublished,
              hasPurchaseIntent: tkPassReason2 === 'both',
              purchaseIntentScore: tkIntentScore2,
              passReason: tkPassReason2,
              visualClass: tkVisualClass2,
              updatedAt: new Date(),
            },
            create: {
              platform: Platform.TIKTOK,
              videoId: `tiktok_${video.id}`,
              title: video.title,
              description: video.description,
              thumbnailUrl: video.thumbnailUrl,
              videoUrl: video.videoUrl,
              authorName: video.authorName,
              authorUrl: `https://www.tiktok.com/@${video.authorId}`,
              viewCount: BigInt(video.viewCount),
              likeCount: BigInt(video.likeCount),
              commentCount: BigInt(video.commentCount),
              shareCount: BigInt(video.shareCount),
              viralScore: computeViralScore(video.viewCount),
              category: classification.category,
              targetAge: classification.targetAge,
              tags: classification.tags,
              country: 'US',
              publishedAt: tkPublished,
              hasPurchaseIntent: tkPassReason2 === 'both',
              purchaseIntentScore: tkIntentScore2,
              passReason: tkPassReason2,
              visualClass: tkVisualClass2,
            },
          });
          tiktokCollected++;
        } catch {}
      }
      await delay(KEYWORD_DELAY_MS);
    } catch (err) {
      console.error(`TikTok search error for "${kw}":`, err);
    }
  }

  return tiktokCollected;
}

/**
 * STEP 4 — 인스타그램 릴스 수집 (RapidAPI 우선, 없으면 공개 API fallback).
 * 틱톡 STEP 3 와 동일 게이트 구조. 전체 budget 초과면 스킵.
 */
async function collectInstagram(ctx: CollectCtx): Promise<number> {
  const { results, processedVideoIds, elapsedMs } = ctx;
  let instagramCollected = 0;

  if (elapsedMs() > HARD_BUDGET_MS) {
    console.log('⏱️ 전체 budget 초과 — Instagram 단계 스킵');
    results.partial = true;
    return instagramCollected;
  }

  // RAPIDAPI_KEY 가 있으면 RapidAPI(자기 IP로 우회) 사용 — Railway DC IP 차단 해결.
  // 없으면 공개 API fallback (대개 prod 에서 0건).
  const rapidKey = process.env.RAPIDAPI_KEY;
  console.log(`\n📷 Collecting Instagram Reels (${rapidKey ? 'RapidAPI 해시태그 검색' : 'public API'})...`);
  try {
    // 틱톡 STEP 3 와 동일 구조: 해시태그 검색 → 조회수/최신성/영어권 →
    // 셀러링크 게이트 → 얼굴 제외 → 저장.
    let reels: import('@/lib/collectors/instagram-api').InstagramReel[] = [];
    const igErrors: string[] = [];
    if (rapidKey) {
      const r = await collectReelsByHashtags(rapidKey);
      reels = r.reels;
      igErrors.push(...r.errors);
    } else {
      const r = await collectKoreanReelsPublic();
      reels = r.reels;
      igErrors.push(...r.errors);
      // 공개 API 경로: creator 정보가 payload 에 동봉 → 먼저 DB 동기화
      for (const [username, info] of r.creators.entries()) {
        await getOrFetchCreator(Platform.INSTAGRAM, username, async () => ({
          bioUrl: info.bioUrl,
          signature: info.signature,
          authorName: info.authorName,
          followerCount: info.followerCount,
        }));
      }
    }
    console.log(`  Found ${reels.length} reels (deduped)`);

    // 조회수 높은 순으로 정렬 — 바이럴 우선 + userinfo 콜 budget 절약
    reels.sort((a, b) => b.viewCount - a.viewCount);

    for (const reel of reels) {
      if (elapsedMs() > HARD_BUDGET_MS) { results.partial = true; break; }
      if (processedVideoIds.has(reel.id)) continue;

      // 1) 값싼 필터 먼저 (틱톡과 동일): 조회수 하한
      if (reel.viewCount < MIN_VIEW_COUNT) continue;
      // 2) 영어권만 — 비서구/비영어 제외 (틱톡과 동일 유틸)
      if (isExcludedContent(`${reel.title} ${reel.description}`, reel.authorName)) continue;
      // 3) 다제품 리스티클 거부 (틱톡과 동일 TALKING_HEAD_RE) — "10 things…" 등
      if (isListicleTitle(`${reel.title} ${reel.description}`)) continue;
      // 4) 최신성 컷오프
      const igPublished = reel.takenAt ? new Date(reel.takenAt * 1000) : null;
      if (!igPublished || igPublished < MIN_PUBLISHED_AT) continue;

      // 4) 셀러 검증 게이트 — userinfo 로 bio 링크 확인 (의뢰인 ③, 캐시됨)
      const igCreator = rapidKey
        ? await getOrFetchCreator(Platform.INSTAGRAM, reel.authorId, () =>
            fetchUserInfo(reel.authorId, rapidKey),
          )
        : await prisma.creator.findUnique({
            where: { platform_authorId: { platform: Platform.INSTAGRAM, authorId: reel.authorId } },
          });
      if (!igCreator?.hasSalesLink) continue;

      // 6) 얼굴캠 제외 (의뢰인 ②) — IG는 face-cam 인플루언서가 많아 'mixed'(얼굴+제품)도 거부
      let igVisualClass: string | null = null;
      if (process.env.GEMINI_API_KEY && reel.thumbnailUrl) {
        igVisualClass = await classifyThumbnail(process.env.GEMINI_API_KEY, reel.thumbnailUrl);
        if (igVisualClass === 'face' || igVisualClass === 'mixed') continue;
      }

      processedVideoIds.add(reel.id);

      try {
        const classification = classifyByKeywords({ title: reel.title, description: reel.description });

        await prisma.video.upsert({
          where: { videoId: `ig_${reel.id}` },
          update: {
            viewCount: BigInt(reel.viewCount),
            likeCount: BigInt(reel.likeCount),
            commentCount: BigInt(reel.commentCount),
            publishedAt: igPublished,
            passReason: 'creator_link',
            visualClass: igVisualClass,
            updatedAt: new Date(),
          },
          create: {
            platform: Platform.INSTAGRAM,
            videoId: `ig_${reel.id}`,
            title: reel.title,
            description: reel.description,
            thumbnailUrl: reel.thumbnailUrl,
            videoUrl: reel.videoUrl,
            authorName: reel.authorName,
            authorUrl: `https://www.instagram.com/${reel.authorId}/`,
            viewCount: BigInt(reel.viewCount),
            likeCount: BigInt(reel.likeCount),
            commentCount: BigInt(reel.commentCount),
            shareCount: BigInt(reel.shareCount),
            viralScore: computeViralScore(reel.viewCount),
            category: classification.category,
            targetAge: classification.targetAge,
            tags: classification.tags,
            country: 'US',
            publishedAt: igPublished,
            passReason: 'creator_link',
            visualClass: igVisualClass,
          },
        });
        instagramCollected++;
      } catch {}
    }

    if (igErrors.length > 0) {
      results.errors.push(...igErrors.slice(0, 3));
    }
    console.log(`📷 Instagram: collected ${instagramCollected} reels`);
  } catch (err) {
    console.error('Instagram collection error:', err);
    results.errors.push('Instagram collection failed');
  }

  return instagramCollected;
}

export async function GET() {
  try {
    const [counts, categoryCounts, lastCollected, topVideos] = await Promise.all([
      prisma.video.groupBy({ by: ['platform'], _count: true }),
      prisma.video.groupBy({ by: ['category'], _count: true }),
      prisma.video.findFirst({
        orderBy: { collectedAt: 'desc' },
        select: { collectedAt: true },
      }),
      prisma.video.findMany({
        orderBy: { viralScore: 'desc' },
        take: 5,
        select: { title: true, viewCount: true, viralScore: true },
      }),
    ]);

    return NextResponse.json({
      counts: counts.reduce((acc, c) => ({ ...acc, [c.platform]: c._count }), {}),
      categories: categoryCounts.reduce((acc, c) => ({ ...acc, [c.category || 'UNKNOWN']: c._count }), {}),
      lastCollected: lastCollected?.collectedAt,
      topVideos: topVideos.map(v => ({
        title: v.title?.substring(0, 50),
        views: Number(v.viewCount),
        score: v.viralScore,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
