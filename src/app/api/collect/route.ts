import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  searchTikTokVideos,
  getTikTokTrending,
  fetchTikTokUser,
  fetchTikTokComments,
} from '@/lib/collectors/tiktok-api';
import { collectKoreanReelsPublic } from '@/lib/collectors/instagram-public';
import { collectReelsByHashtags, fetchUserInfo } from '@/lib/collectors/instagram-api';
import { getOrFetchCreator } from '@/lib/creators';
import { classifyByKeywords } from '@/lib/classifier';
import { evaluateCandidate, type Candidate, type GateMetrics } from '@/lib/collect-gate';
import {
  CALIBRATION_MODE,
  COMMENT_SAMPLE,
  HARD_BUDGET_MS,
  KEYWORD_DELAY_MS,
  TIKTOK_SEARCH_COUNT,
  TIKTOK_TRENDING_COUNT,
  TK_DEADLINE_MS,
  computeViralScore,
  getKeywordsForRun,
} from '@/lib/collect-config';
import { Platform } from '@prisma/client';

/**
 * 위닝 프로덕트 수집기 — 기준서: docs/COLLECTION_CRITERIA_V2.md
 *
 * TikTok 트렌딩 / TikTok 키워드 / Instagram 릴스 세 채널에서 후보를 모아
 * 공용 게이트(evaluateCandidate)로 판정·점수화한 뒤 저장한다.
 * 판정 기준은 전부 collect-gate.ts + collect-config.ts 에 있고 이 파일은
 * "어디서 긁어와서 어떻게 저장하는지"만 담당한다.
 */

// 수집은 최대 ~520초 — Railway/Vercel 기본 타임아웃 회피
export const maxDuration = 600;

interface CollectResults {
  videosSearched: number;
  videosCollected: number;
  videosSkipped: number;
  /** 탈락 사유별 건수 — 캘리브레이션 때 "왜 안 걸리는지" 진단용 */
  skipReasons: Record<string, number>;
  /**
   * Gemini 분석 없이 저장된 건수. 0 이 아니면 쿼터(429)에 막혀 제품 필터가
   * 실질적으로 꺼진 상태라는 뜻 — 수집 품질 저하의 1순위 신호다.
   */
  visionUnavailable: number;
  errors: string[];
  partial: boolean;
}

interface CollectCtx {
  results: CollectResults;
  processedVideoIds: Set<string>;
  elapsedMs: () => number;
}

function noteSkip(ctx: CollectCtx, reason: string) {
  ctx.results.videosSkipped++;
  ctx.results.skipReasons[reason] = (ctx.results.skipReasons[reason] || 0) + 1;
}

function noteMetrics(ctx: CollectCtx, m: GateMetrics) {
  if (m.flags.includes('NO_VISION')) ctx.results.visionUnavailable++;
}

/** 저장할 영상의 원본 필드 — 플랫폼별 응답을 이 형태로 정규화해서 넘긴다. */
interface SaveInput {
  platform: Platform;
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string | null;
  authorUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  publishedAt: Date;
}

/**
 * upsert — create/update 가 동일한 필드 집합을 쓴다.
 * v1은 TikTok 키워드 루프의 update 블록만 필드가 빠져 있어, 재수집될 때마다
 * category/tags/댓글수가 낡은 값으로 남는 문제가 있었다.
 */
async function saveVideo(v: SaveInput, m: GateMetrics): Promise<boolean> {
  // 카테고리 분류는 Gemini 가 뽑아준 제품 일반명을 함께 넣어 정확도를 올린다
  const classification = classifyByKeywords({
    title: v.title,
    description: `${v.description} ${m.productType || ''}`,
  });

  const shared = {
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    viewCount: BigInt(v.viewCount),
    likeCount: BigInt(v.likeCount),
    commentCount: BigInt(v.commentCount),
    shareCount: BigInt(v.shareCount),
    category: classification.category,
    targetAge: classification.targetAge,
    tags: classification.tags,
    country: 'US',
    publishedAt: v.publishedAt,
    hasPurchaseIntent: m.hasPurchaseIntent,
    purchaseIntentScore: m.purchaseIntentScore,
    visualClass: m.visualClass,
    productScore: m.productScore,
    tier: m.tier,
    scoreBreakdown: m.scoreBreakdown as unknown as object,
    flags: m.flags,
    viewsPerDay: m.viewsPerDay,
    productType: m.productType,
    priceBand: m.priceBand,
    brand: m.brand,
  };

  try {
    await prisma.video.upsert({
      where: { videoId: v.videoId },
      update: { ...shared, updatedAt: new Date() },
      create: {
        ...shared,
        platform: v.platform,
        videoId: v.videoId,
        description: v.description,
        videoUrl: v.videoUrl,
        authorName: v.authorName,
        authorUrl: v.authorUrl,
        viralScore: computeViralScore(v.viewCount),
      },
    });
    return true;
  } catch (err) {
    console.error(`save error (${v.videoId}):`, err);
    return false;
  }
}

/** TikTok 응답 → 게이트 후보 + 저장 입력. 두 루프가 공유. */
function toTikTokCandidate(video: Awaited<ReturnType<typeof getTikTokTrending>>[number]) {
  const publishedAt = video.createTime ? new Date(video.createTime * 1000) : null;
  const candidate: Candidate = {
    platform: Platform.TIKTOK,
    authorId: video.authorId,
    authorName: video.authorName,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    shareCount: video.shareCount,
    publishedAt,
    fetchSalesLink: async () => {
      const creator = await getOrFetchCreator(Platform.TIKTOK, video.authorId, () =>
        fetchTikTokUser(video.authorId),
      );
      return !!creator?.hasSalesLink;
    },
    fetchComments: () => fetchTikTokComments(video.videoUrl, COMMENT_SAMPLE),
  };
  return { candidate, publishedAt };
}

async function processTikTokVideo(
  ctx: CollectCtx,
  video: Awaited<ReturnType<typeof getTikTokTrending>>[number],
): Promise<boolean> {
  if (ctx.processedVideoIds.has(video.id)) return false;
  const { candidate, publishedAt } = toTikTokCandidate(video);

  const verdict = await evaluateCandidate(candidate);
  if (!verdict.pass) {
    noteSkip(ctx, verdict.reason);
    return false;
  }
  ctx.processedVideoIds.add(video.id);
  noteMetrics(ctx, verdict.metrics);

  return saveVideo(
    {
      platform: Platform.TIKTOK,
      videoId: `tiktok_${video.id}`,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      videoUrl: video.videoUrl,
      authorName: video.authorName,
      authorUrl: `https://www.tiktok.com/@${video.authorId}`,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      shareCount: video.shareCount,
      publishedAt: publishedAt!,
    },
    verdict.metrics,
  );
}

async function collectTikTokTrending(ctx: CollectCtx): Promise<number> {
  let collected = 0;
  try {
    const trending = await getTikTokTrending({ count: TIKTOK_TRENDING_COUNT });
    console.log(`  Found ${trending.length} trending TikTok videos`);
    ctx.results.videosSearched += trending.length;

    for (const video of trending) {
      if (ctx.elapsedMs() > TK_DEADLINE_MS) {
        console.log('⏱️ TikTok 트렌딩 budget 초과 — 조기 종료');
        ctx.results.partial = true;
        break;
      }
      if (await processTikTokVideo(ctx, video)) collected++;
    }
  } catch (err) {
    console.error('TikTok trending error:', err);
    ctx.results.errors.push('TikTok trending failed');
  }
  return collected;
}

async function collectTikTokKeywords(ctx: CollectCtx): Promise<number> {
  let collected = 0;
  const keywords = getKeywordsForRun();
  console.log(`  Keywords this run: ${keywords.join(', ')}`);

  for (const kw of keywords) {
    if (ctx.elapsedMs() > TK_DEADLINE_MS) {
      console.log('⏱️ TikTok 키워드 budget 초과 — 남은 키워드 스킵');
      ctx.results.partial = true;
      break;
    }
    try {
      const videos = await searchTikTokVideos(kw, { count: TIKTOK_SEARCH_COUNT });
      ctx.results.videosSearched += videos.length;

      for (const video of videos) {
        if (ctx.elapsedMs() > TK_DEADLINE_MS) {
          ctx.results.partial = true;
          break;
        }
        if (await processTikTokVideo(ctx, video)) collected++;
      }
      await delay(KEYWORD_DELAY_MS);
    } catch (err) {
      console.error(`TikTok search error for "${kw}":`, err);
    }
  }
  return collected;
}

async function collectInstagram(ctx: CollectCtx): Promise<number> {
  let collected = 0;

  if (ctx.elapsedMs() > HARD_BUDGET_MS) {
    console.log('⏱️ 전체 budget 초과 — Instagram 단계 스킵');
    ctx.results.partial = true;
    return 0;
  }

  // RAPIDAPI_KEY 가 있으면 RapidAPI(자기 IP로 우회) 사용 — Railway DC IP 차단 회피.
  // 없으면 공개 API fallback (대개 prod 에서 0건).
  const rapidKey = process.env.RAPIDAPI_KEY;
  console.log(`\n📷 Collecting Instagram Reels (${rapidKey ? 'RapidAPI 해시태그' : 'public API'})...`);

  try {
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
      // 공개 API 경로는 creator 정보가 payload 에 동봉되므로 먼저 DB 동기화
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
    ctx.results.videosSearched += reels.length;

    // 조회수 높은 순 — 바이럴 우선 + budget 소진 시 상위부터 확보
    reels.sort((a, b) => b.viewCount - a.viewCount);

    for (const reel of reels) {
      if (ctx.elapsedMs() > HARD_BUDGET_MS) {
        ctx.results.partial = true;
        break;
      }
      if (ctx.processedVideoIds.has(reel.id)) continue;

      const publishedAt = reel.takenAt ? new Date(reel.takenAt * 1000) : null;
      const candidate: Candidate = {
        platform: Platform.INSTAGRAM,
        authorId: reel.authorId,
        authorName: reel.authorName,
        title: reel.title,
        description: reel.description,
        thumbnailUrl: reel.thumbnailUrl,
        viewCount: reel.viewCount,
        likeCount: reel.likeCount,
        commentCount: reel.commentCount,
        shareCount: reel.shareCount,
        publishedAt,
        // IG 는 댓글 조회 API 가 없어 수요(§4-A) 미측정 → NO_COMMENTS 플래그로 남는다
        fetchSalesLink: async () => {
          const creator = rapidKey
            ? await getOrFetchCreator(Platform.INSTAGRAM, reel.authorId, () =>
                fetchUserInfo(reel.authorId, rapidKey),
              )
            : await prisma.creator.findUnique({
                where: {
                  platform_authorId: { platform: Platform.INSTAGRAM, authorId: reel.authorId },
                },
              });
          return !!creator?.hasSalesLink;
        },
      };

      const verdict = await evaluateCandidate(candidate);
      if (!verdict.pass) {
        noteSkip(ctx, verdict.reason);
        continue;
      }
      ctx.processedVideoIds.add(reel.id);
      noteMetrics(ctx, verdict.metrics);

      const saved = await saveVideo(
        {
          platform: Platform.INSTAGRAM,
          videoId: `ig_${reel.id}`,
          title: reel.title,
          description: reel.description,
          thumbnailUrl: reel.thumbnailUrl,
          videoUrl: reel.videoUrl,
          authorName: reel.authorName,
          authorUrl: `https://www.instagram.com/${reel.authorId}/`,
          viewCount: reel.viewCount,
          likeCount: reel.likeCount,
          commentCount: reel.commentCount,
          shareCount: reel.shareCount,
          publishedAt: publishedAt!,
        },
        verdict.metrics,
      );
      if (saved) collected++;
    }

    if (igErrors.length > 0) ctx.results.errors.push(...igErrors.slice(0, 3));
    console.log(`📷 Instagram: collected ${collected} reels`);
  } catch (err) {
    console.error('Instagram collection error:', err);
    ctx.results.errors.push('Instagram collection failed');
  }

  return collected;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: CollectResults = {
    videosSearched: 0,
    videosCollected: 0,
    videosSkipped: 0,
    skipReasons: {},
    visionUnavailable: 0,
    errors: [],
    partial: false,
  };

  // ===== Wall-clock budget =====
  // 종료 주체(Railway 프록시 / GitHub curl 600s)가 무엇이든 그 전에 우리가 먼저
  // 정상 종료하고 200 partial 을 반환한다. 플랫폼별 deadline 으로 슬롯을 나눠
  // 어느 날이든 두 채널 모두 일부는 수집되게 함.
  const startedAt = Date.now();
  const ctx: CollectCtx = {
    results,
    processedVideoIds: new Set<string>(),
    elapsedMs: () => Date.now() - startedAt,
  };

  try {
    console.log(`\n🎯 Collect start (calibration=${CALIBRATION_MODE})`);

    console.log('\n🎵 Collecting TikTok videos...');
    let tiktokCollected = await collectTikTokTrending(ctx);
    tiktokCollected += await collectTikTokKeywords(ctx);
    console.log(`🎵 TikTok: collected ${tiktokCollected} videos`);

    const instagramCollected = await collectInstagram(ctx);

    results.videosCollected = tiktokCollected + instagramCollected;

    return NextResponse.json({
      success: true,
      calibrationMode: CALIBRATION_MODE,
      partial: results.partial,
      elapsedMs: ctx.elapsedMs(),
      results: { ...results, tiktokCollected, instagramCollected },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Collection error:', error);
    return NextResponse.json({ error: 'Collection failed', details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const [counts, categoryCounts, tierCounts, lastCollected, topVideos] = await Promise.all([
      prisma.video.groupBy({ by: ['platform'], _count: true }),
      prisma.video.groupBy({ by: ['category'], _count: true }),
      prisma.video.groupBy({ by: ['tier'], _count: true }),
      prisma.video.findFirst({ orderBy: { collectedAt: 'desc' }, select: { collectedAt: true } }),
      prisma.video.findMany({
        orderBy: { productScore: 'desc' },
        take: 5,
        select: { title: true, viewCount: true, productScore: true, tier: true },
      }),
    ]);

    return NextResponse.json({
      calibrationMode: CALIBRATION_MODE,
      counts: counts.reduce((acc, c) => ({ ...acc, [c.platform]: c._count }), {}),
      categories: categoryCounts.reduce((acc, c) => ({ ...acc, [c.category || 'UNKNOWN']: c._count }), {}),
      tiers: tierCounts.reduce((acc, c) => ({ ...acc, [c.tier || 'UNRATED']: c._count }), {}),
      lastCollected: lastCollected?.collectedAt,
      topVideos: topVideos.map((v) => ({
        title: v.title?.substring(0, 50),
        views: Number(v.viewCount),
        score: v.productScore,
        tier: v.tier,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
