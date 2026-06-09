import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  searchYouTubeShorts,
  getYouTubeVideoUrl,
  getYouTubeChannelUrl,
  fetchYouTubeChannel,
  fetchYouTubeComments,
} from '@/lib/collectors/youtube';
import {
  searchTikTokVideos,
  getTikTokTrending,
  fetchTikTokUser,
  fetchTikTokComments,
} from '@/lib/collectors/tiktok-api';
import { collectKoreanReelsPublic } from '@/lib/collectors/instagram-public';
import { collectReelsByHashtags, fetchUserInfo } from '@/lib/collectors/instagram-api';
import { isExcludedContent } from '@/lib/exclude';
import { getOrFetchCreator, isQualifiedSeller } from '@/lib/creators';
import { scorePurchaseIntent, evaluatePass } from '@/lib/comments';
import {
  getRisingProductTrends,
  getDailyTrendingProducts,
  generateSearchQueries,
  VIRAL_PRODUCT_KEYWORDS,
} from '@/lib/collectors/trendCollector';
import { classifyVideo, classifyByKeywords } from '@/lib/classifier';
import { classifyThumbnail } from '@/lib/vision';
import { calculateViralScore } from '@/lib/utils';
import { Platform } from '@prisma/client';

// 수집은 ~60초 걸림 — Vercel/Railway 기본 타임아웃 회피
export const maxDuration = 300;

// 최신성 컷오프 — 이 날짜 이전 업로드된 영상은 모두 스킵
const MIN_PUBLISHED_AT = new Date('2025-12-01T00:00:00Z');

/**
 * Smart Dropshipping Product Video Collector
 *
 * 전략:
 * 1. Google Trends에서 급상승 상품 키워드 수집
 * 2. 해당 키워드로 YouTube 검색 (최근 48시간, 조회수 높은 것)
 * 3. 드랍쉬핑 특화 키워드 병행 검색
 * 4. 높은 engagement 영상만 저장
 */

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    trendsFound: 0,
    videosSearched: 0,
    videosCollected: 0,
    videosSkipped: 0,
    errors: [] as string[],
    partial: false, // wall-clock budget 초과로 일부 단계를 조기 종료했는지
  };

  // ===== Wall-clock budget =====
  // 종료 주체(Railway 프록시 / Node 서버 / GitHub curl 600s)가 무엇이든
  // 그 전에 우리가 먼저 정상 종료하고 200 partial 을 반환한다.
  // 플랫폼별 deadline 으로 슬롯을 나눠 어느 날이든 세 채널 모두 일부는 수집되게 함.
  const startedAt = Date.now();
  const elapsedMs = () => Date.now() - startedAt;
  const YT_DEADLINE_MS = 120_000; // YouTube 단계는 120s 까지
  const TK_DEADLINE_MS = 215_000; // TikTok 단계는 215s 까지
  const HARD_BUDGET_MS = 230_000; // 전체 하드캡 (어떤 종료 주체보다도 앞서서)

  // Parse request options
  let manualKeyword: string | undefined;
  let targetGeo = 'US'; // 기본: 영어권 (해외 아이디어템 풀)

  try {
    const body = await request.json();
    if (body.keyword) manualKeyword = body.keyword;
    if (body.geo) targetGeo = body.geo;
  } catch {
    // Empty body is OK
  }

  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YOUTUBE_API_KEY required' }, { status: 500 });
    }

    // ===== STEP 1: 검색 키워드 수집 =====
    let searchQueries: string[] = [];

    if (manualKeyword) {
      // 수동 키워드: 영어 product-discovery suffix 자동 부착
      searchQueries = [
        `${manualKeyword} review shorts`,
        `${manualKeyword} unboxing`,
        `${manualKeyword} amazon finds`,
      ];
    } else {
      // Google Trends에서 급상승 상품 트렌드 가져오기
      console.log('🔍 Fetching rising product trends from Google Trends...');

      try {
        const [risingTrends, dailyTrends] = await Promise.all([
          getRisingProductTrends(targetGeo),
          getDailyTrendingProducts(targetGeo),
        ]);

        results.trendsFound = risingTrends.length + dailyTrends.length;
        console.log(`📈 Found ${risingTrends.length} rising trends, ${dailyTrends.length} daily trends`);

        // 트렌드 기반 검색 쿼리 생성
        searchQueries = generateSearchQueries(risingTrends);

        // 일일 트렌드 추가
        for (const trend of dailyTrends.slice(0, 5)) {
          searchQueries.push(`${trend} shorts review`);
        }
      } catch (err) {
        console.error('Google Trends error:', err);
        results.errors.push('Google Trends fetch failed');
      }

      // 트렌드가 없으면 기본 해외 아이디어템 키워드 사용
      if (searchQueries.length === 0) {
        console.log('⚠️ No trends found, using default global product keywords');
        searchQueries = [...VIRAL_PRODUCT_KEYWORDS.global];
      }
    }

    console.log(`🔎 Search queries (${searchQueries.length}):`, searchQueries.slice(0, 5));

    // ===== STEP 2: YouTube 검색 =====
    const processedVideoIds = new Set<string>();
    const MIN_VIEWS = 20000; // 해외 영상 조회수 2만 이상 (3일 윈도우 고려)
    const MIN_ENGAGEMENT = 0.01; // 최소 1% 참여율

    for (const query of searchQueries.slice(0, 15)) { // 최대 15개 쿼리
      // budget: YouTube 슬롯 초과 시 남은 쿼리 건너뛰고 다음 플랫폼으로
      if (elapsedMs() > YT_DEADLINE_MS) {
        console.log(`⏱️ YouTube 단계 budget(${YT_DEADLINE_MS}ms) 초과 — 남은 쿼리 스킵`);
        results.partial = true;
        break;
      }
      console.log(`\n🎬 Searching: "${query}"`);

      try {
        // 최근 48시간 영상만, 조회수순 정렬
        const videos = await searchYouTubeShorts(process.env.YOUTUBE_API_KEY, {
          query,
          maxResults: 15,
          regionCode: targetGeo,
        });

        results.videosSearched += videos.length;

        for (const video of videos) {
          if (elapsedMs() > YT_DEADLINE_MS) { results.partial = true; break; }
          if (processedVideoIds.has(video.id)) continue;
          processedVideoIds.add(video.id);

          // Engagement 필터
          const engagement = video.viewCount > 0 ? video.likeCount / video.viewCount : 0;

          if (video.viewCount < MIN_VIEWS) {
            results.videosSkipped++;
            continue;
          }

          if (engagement < MIN_ENGAGEMENT) {
            results.videosSkipped++;
            continue;
          }

          // 최신성 컷오프
          const ytPublished = new Date(video.publishedAt);
          if (ytPublished < MIN_PUBLISHED_AT) {
            results.videosSkipped++;
            continue;
          }

          // 셀러 검증 게이트 — creator profile + 댓글 구매 의도 둘 다 확인
          // (이전엔 OR 게이트라 creator 통과하면 댓글 검증 스킵 → "viral but no buyers"
          //  영상이 새는 문제. 이제는 'both' 또는 'comment_intent'만 통과)
          const ytCreator = await getOrFetchCreator(Platform.YOUTUBE, video.channelId, () =>
            fetchYouTubeChannel(video.channelId, process.env.YOUTUBE_API_KEY!),
          );
          const ytComments = await fetchYouTubeComments(video.id, process.env.YOUTUBE_API_KEY!, 20);
          const ytIntentScore = scorePurchaseIntent(ytComments);
          const { passReason: ytPassReason, dpm: ytDpm } = evaluatePass(
            !!ytCreator?.hasSalesLink,
            ytIntentScore,
            video.commentCount,
            video.viewCount,
          );
          if (!ytPassReason) {
            results.videosSkipped++;
            continue;
          }
          void ytDpm;

          // 비전 게이트 — 얼굴 위주 영상 거부 (의뢰인 기준 #2)
          let ytVisualClass: string | null = null;
          if (process.env.GEMINI_API_KEY) {
            ytVisualClass = await classifyThumbnail(process.env.GEMINI_API_KEY, video.thumbnailUrl);
            if (ytVisualClass === 'face') {
              results.videosSkipped++;
              continue;
            }
          }

          try {
            // AI 분류
            let classification;
            if (process.env.GEMINI_API_KEY) {
              classification = await classifyVideo(process.env.GEMINI_API_KEY, {
                title: video.title,
                description: video.description,
                authorName: video.channelTitle,
              });
            } else {
              classification = classifyByKeywords({
                title: video.title,
                description: video.description,
              });
            }

            // 상품이 아닌 영상 스킵
            if (classification.category === 'OTHER') {
              console.log(`  ❌ Skip (not product): ${video.title.substring(0, 40)}...`);
              results.videosSkipped++;
              continue;
            }

            // DB 저장
            const existing = await prisma.video.findUnique({
              where: { videoId: video.id },
            });

            const history = (existing?.viewCountHistory as Array<{ date: string; count: number }>) || [];
            history.push({ date: new Date().toISOString(), count: video.viewCount });
            const recentHistory = history.slice(-30);
            const viralScore = calculateViralScore(recentHistory);

            await prisma.video.upsert({
              where: { videoId: video.id },
              update: {
                title: video.title,
                description: video.description,
                thumbnailUrl: video.thumbnailUrl,
                viewCount: BigInt(video.viewCount),
                likeCount: BigInt(video.likeCount),
                commentCount: BigInt(video.commentCount),
                viewCountHistory: recentHistory,
                viralScore,
                category: classification.category,
                targetAge: classification.targetAge,
                tags: classification.tags,
                country: video.country || targetGeo,
                hasPurchaseIntent: ytPassReason === 'both',
                purchaseIntentScore: ytIntentScore,
                passReason: ytPassReason,
                visualClass: ytVisualClass,
                updatedAt: new Date(),
              },
              create: {
                platform: Platform.YOUTUBE,
                videoId: video.id,
                title: video.title,
                description: video.description,
                thumbnailUrl: video.thumbnailUrl,
                videoUrl: getYouTubeVideoUrl(video.id),
                authorName: video.channelTitle,
                authorUrl: getYouTubeChannelUrl(video.channelId),
                viewCount: BigInt(video.viewCount),
                likeCount: BigInt(video.likeCount),
                commentCount: BigInt(video.commentCount),
                viewCountHistory: recentHistory,
                viralScore,
                category: classification.category,
                targetAge: classification.targetAge,
                tags: classification.tags,
                country: video.country || targetGeo,
                hasPurchaseIntent: ytPassReason === 'both',
                purchaseIntentScore: ytIntentScore,
                passReason: ytPassReason,
                visualClass: ytVisualClass,
                publishedAt: new Date(video.publishedAt),
              },
            });

            console.log(`  ✅ Saved: ${video.title.substring(0, 40)}... (${formatNumber(video.viewCount)} views, ${(engagement * 100).toFixed(1)}% eng)`);
            results.videosCollected++;
          } catch (err) {
            console.error('Video save error:', err);
            results.errors.push(`Save failed: ${video.id}`);
          }
        }
      } catch (err) {
        console.error(`Search error for "${query}":`, err);
        results.errors.push(`Search failed: ${query}`);
      }

      await delay(500); // Rate limiting
    }

    // ===== STEP 3: 틱톡 수집 =====
    console.log('\n🎵 Collecting TikTok videos...');
    let tiktokCollected = 0;

    try {
      // 틱톡 트렌딩 (US)
      const trendingVideos = await getTikTokTrending({ count: 30 });
      console.log(`  Found ${trendingVideos.length} trending TikTok videos`);

      for (const video of trendingVideos) {
        if (elapsedMs() > TK_DEADLINE_MS) {
          console.log(`⏱️ TikTok 트렌딩 budget 초과 — 조기 종료`);
          results.partial = true;
          break;
        }
        if (processedVideoIds.has(video.id)) continue;
        if (video.viewCount < 20000) continue;
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
        const tkComments = await fetchTikTokComments(video.videoUrl, 20);
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
              category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
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
              viralScore: video.viewCount > 1000000 ? 90 : video.viewCount > 100000 ? 60 : 30,
              category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
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

    // 틱톡 키워드 검색 — 의뢰인 골든 (Daily Sunbeam 도시락, Good Stuff Diary 모션조명,
    // CozyPrime 충전기 류)을 잡는 다양한 angle. amazon-중심에서 확장:
    // 단일 제품 시연 / 스마트홈 / 실생활 해결 / 가성비 / 신박한 아이디어
    const tiktokKeywords = [
      // 메가 해시태그
      'tiktokmademebuyit', 'amazonfinds', 'amazonmusthaves',
      'amazonhaul', 'temufinds', 'sheinfinds', 'aliexpressfinds',
      'tiktokshop', 'tiktokshopfinds',
      // 가젯 카테고리 (Daily Sunbeam 도시락 → kitchen, AlexFinds 키보드 → tech)
      'cool gadgets', 'kitchen gadgets', 'home gadgets',
      'office gadgets', 'car gadgets', 'travel gadgets',
      'tech gadgets', 'smart home gadgets',
      // 컨셉 (Good Stuff Diary 조명/펜 → 작은 발명)
      'must have products', 'satisfying products', 'genius inventions',
      'cool inventions', 'lifehack products', 'organization gadgets',
      'useful gadgets', 'clever inventions', 'smart products',
      // 진성 셀러 표현
      'i bought this', 'this changed my life', 'best purchase',
      'product review', 'unboxing', 'amazon best sellers',
      // 트렌드형
      'viral products', 'viral gadgets 2026', 'must have gadgets',
      'amazon must haves', 'tiktok shop finds', 'small business products',
      // 의뢰인 골든 톤 (Daily Sunbeam 도시락 같은 단일 시연)
      'portable gadgets', 'mini gadgets', 'compact gadget',
    ];
    for (const kw of tiktokKeywords) {
      // budget: TikTok 슬롯 초과 시 남은 키워드 스킵
      if (elapsedMs() > TK_DEADLINE_MS) {
        console.log(`⏱️ TikTok 키워드 budget 초과 — 남은 키워드 스킵`);
        results.partial = true;
        break;
      }
      try {
        const videos = await searchTikTokVideos(kw, { count: 30 });
        for (const video of videos) {
          if (elapsedMs() > TK_DEADLINE_MS) { results.partial = true; break; }
          if (processedVideoIds.has(video.id)) continue;
          if (video.viewCount < 20000) continue;
          if (!/[a-zA-Z]{3,}/.test(video.title)) continue;
          if (/[가-힣]/.test(video.title)) continue;

          // 최신성 컷오프
          const tkPublished = video.createTime ? new Date(video.createTime * 1000) : null;
          if (!tkPublished || tkPublished < MIN_PUBLISHED_AT) continue;

          // 셀러 검증 게이트 — creator + 댓글 둘 다 확인
          const tkCreator2 = await getOrFetchCreator(Platform.TIKTOK, video.authorId, () =>
            fetchTikTokUser(video.authorId),
          );
          const tkComments2 = await fetchTikTokComments(video.videoUrl, 20);
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
                viralScore: video.viewCount > 1000000 ? 90 : video.viewCount > 100000 ? 60 : 30,
                category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
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
        await delay(300);
      } catch (err) {
        console.error(`TikTok search error for "${kw}":`, err);
      }
    }

    console.log(`🎵 TikTok: collected ${tiktokCollected} videos`);

    // ===== STEP 4: 인스타그램 릴스 수집 (공개 API, 키 불필요) =====
    let instagramCollected = 0;

    if (elapsedMs() > HARD_BUDGET_MS) {
      console.log('⏱️ 전체 budget 초과 — Instagram 단계 스킵');
      results.partial = true;
    } else {
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

          // 1) 값싼 필터 먼저 (틱톡과 동일): 조회수 ≥ 20000
          if (reel.viewCount < 20000) continue;
          // 2) 영어권만 — 비서구/비영어 제외 (틱톡과 동일 유틸)
          if (isExcludedContent(`${reel.title} ${reel.description}`, reel.authorName)) continue;
          // 3) 최신성 컷오프
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

          // 5) 얼굴캠 제외 (의뢰인 ②) — 틱톡과 동일 비전 게이트
          let igVisualClass: string | null = null;
          if (process.env.GEMINI_API_KEY && reel.thumbnailUrl) {
            igVisualClass = await classifyThumbnail(process.env.GEMINI_API_KEY, reel.thumbnailUrl);
            if (igVisualClass === 'face') continue;
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
                viralScore: reel.viewCount > 1000000 ? 90 : reel.viewCount > 100000 ? 60 : 30,
                category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
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
    }

    return NextResponse.json({
      success: true,
      partial: results.partial, // budget 초과로 일부 단계를 조기 종료했어도 성공 응답
      elapsedMs: elapsedMs(),
      results: {
        ...results,
        tiktokCollected,
        instagramCollected,
      },
      searchQueries: searchQueries.slice(0, 10),
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

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
