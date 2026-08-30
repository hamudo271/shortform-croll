import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  searchTikTokVideos,
  getTikTokTrending,
  fetchTikTokUser,
  fetchTikTokComments,
  type TikTokVideo,
} from '@/lib/collectors/tiktok-api';
import { collectKoreanReelsPublic } from '@/lib/collectors/instagram-public';
import { collectReelsByHashtags, IG_BUYINTENT_HASHTAGS } from '@/lib/collectors/instagram-api';
import { getOrFetchCreator } from '@/lib/creators';
import { classifyByKeywords } from '@/lib/classifier';
import { evaluateCandidate, type Candidate, type GateMetrics } from '@/lib/collect-gate';
import { FLAG_RISING } from '@/lib/scoring';
import { sendCollectAlerts } from '@/lib/notify';
import { applyKeywordLearning, loadLearnedRules, type LearnedRules } from '@/lib/learning';
import {
  CALIBRATION_MODE,
  COMMENT_SAMPLE,
  HARD_BUDGET_MS,
  IG_HASHTAGS_PER_RUN,
  KEYWORD_DELAY_MS,
  isIgRunSlot,
  pickIgHashtags,
  TIKTOK_SEARCH_COUNT,
  TIKTOK_TRENDING_COUNT,
  RISING_MIN_RATIO,
  TK_DEADLINE_MS,
  TK_FETCH_DEADLINE_MS,
  VIEW_HISTORY_MAX,
  computeViralScore,
  computeViewsPerDay,
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
  /**
   * 후보로 잡혔지만 시간이 없어 판정조차 못 한 건수.
   * 이게 크면 "기준이 빡세서" 가 아니라 "예산이 모자라서" 덜 모인 것 —
   * 두 원인은 대응이 정반대라 반드시 구분해야 한다.
   */
  candidatesNotEvaluated: number;
  errors: string[];
  partial: boolean;
}

interface CollectCtx {
  results: CollectResults;
  processedVideoIds: Set<string>;
  elapsedMs: () => number;
  /** 운영자 라벨에서 학습한 규칙 — 회차 시작 시 1회 로드 */
  rules: LearnedRules;
  /** 회차 중 발생한 S티어 진입·급상승 이벤트 — 종료 시 텔레그램 1통으로 발송 */
  alerts: string[];
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
  /** 이 영상을 찾아낸 검색 키워드 — 키워드별 적중률 학습의 키 */
  sourceKeyword: string | null;
}

/**
 * upsert — create/update 가 동일한 필드 집합을 쓴다.
 * v1은 TikTok 키워드 루프의 update 블록만 필드가 빠져 있어, 재수집될 때마다
 * category/tags/댓글수가 낡은 값으로 남는 문제가 있었다.
 */
async function saveVideo(
  v: SaveInput,
  m: GateMetrics,
): Promise<{ saved: boolean; alert: string | null }> {
  // 카테고리 분류는 Gemini 가 뽑아준 제품 일반명을 함께 넣어 정확도를 올린다
  const classification = classifyByKeywords({
    title: v.title,
    description: `${v.description} ${m.productType || ''}`,
  });

  // ===== RISING (§7) + 조회수 추이 =====
  // 재수집이면 직전 기록과 비교한다. A티어인데 일 조회수가 오히려 +20% 이상
  // 올랐으면(자연 감소하는 지표라 상승 자체가 가속 신호) 워치리스트 승격 후보.
  const existing = await prisma.video.findUnique({
    where: { videoId: v.videoId },
    select: { tier: true, viewsPerDay: true, viewCountHistory: true, flags: true },
  });

  let flags = m.flags;
  let rising = false;
  if (existing) {
    rising =
      existing.tier === 'A' &&
      existing.viewsPerDay > 0 &&
      m.viewsPerDay >= existing.viewsPerDay * RISING_MIN_RATIO;
    // 매 재수집마다 재판정 — 기세가 꺾이면 플래그도 내려간다
    flags = rising ? [...new Set([...flags, FLAG_RISING])] : flags.filter((f) => f !== FLAG_RISING);
  }

  // ===== 알림 이벤트 — "새로" 발생한 것만 (재수집마다 반복 발송 방지) =====
  let alert: string | null = null;
  if (m.tier === 'S' && existing?.tier !== 'S') {
    alert = `🏆 S티어 진입 ${m.productScore}/10 · 일조회 ${Math.round(m.viewsPerDay / 1000)}k\n${v.title.slice(0, 60)}\n${v.videoUrl}`;
  } else if (rising && existing && !(existing.flags || []).includes(FLAG_RISING)) {
    const gain = Math.round((m.viewsPerDay / existing.viewsPerDay - 1) * 100);
    alert = `🚀 급상승 +${gain}% (A티어 ${m.productScore}/10)\n${v.title.slice(0, 60)}\n${v.videoUrl}`;
  }

  // 조회수 추이 — 하루 1엔트리(그날 마지막 값), 최근 한 달치만 보관
  const today = new Date().toISOString().slice(0, 10);
  const prevHistory = Array.isArray(existing?.viewCountHistory)
    ? (existing.viewCountHistory as { date: string; count: number }[])
    : [];
  const viewCountHistory = [
    ...prevHistory.filter((h) => h?.date !== today),
    { date: today, count: v.viewCount },
  ].slice(-VIEW_HISTORY_MAX);

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
    flags,
    viewCountHistory,
    viewsPerDay: m.viewsPerDay,
    productType: m.productType,
    priceBand: m.priceBand,
    brand: m.brand,
    sourceKeyword: v.sourceKeyword,
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
    return { saved: true, alert };
  } catch (err) {
    console.error(`save error (${v.videoId}):`, err);
    return { saved: false, alert: null };
  }
}

/** TikTok 응답 → 게이트 후보 + 저장 입력. 두 루프가 공유. */
function toTikTokCandidate(video: TikTokVideo) {
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
  video: TikTokVideo,
  sourceKeyword: string | null,
): Promise<boolean> {
  if (ctx.processedVideoIds.has(video.id)) return false;
  // 운영자가 이미 ❌ 를 준 영상 — 재판정은 Gemini/댓글 쿼터 낭비다
  if (ctx.rules.rejectedVideoIds.has(`tiktok_${video.id}`)) {
    noteSkip(ctx, 'already_rejected');
    return false;
  }
  const { candidate, publishedAt } = toTikTokCandidate(video);

  const verdict = await evaluateCandidate(candidate, ctx.rules);
  if (!verdict.pass) {
    noteSkip(ctx, verdict.reason);
    return false;
  }
  ctx.processedVideoIds.add(video.id);
  noteMetrics(ctx, verdict.metrics);

  const result = await saveVideo(
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
      sourceKeyword,
    },
    verdict.metrics,
  );
  if (result.alert) ctx.alerts.push(result.alert);
  return result.saved;
}

/**
 * TikTok 수집 — 먼저 싸게 다 긁어 모으고(트렌딩 + 키워드), 급상승 순으로 정렬한 뒤
 * 판정한다.
 *
 * 순서가 중요한 이유: 판정 1건당 Gemini 콜이 1회 나가는데 무료 티어가 분당 10회라
 * 사실상 회차당 수십 건이 상한이다. 즉 비전 콜은 희소 자원이고, API 가 준 순서대로
 * 쓰면 시시한 영상에 다 써버린다. 일 조회수 높은 후보부터 쓰는 게 맞다.
 */
async function collectTikTok(ctx: CollectCtx): Promise<number> {
  // 후보와 함께 "어느 키워드가 찾았는지"를 들고 다닌다 — 키워드 적중률 학습의 원료
  const pool: { video: TikTokVideo; sourceKeyword: string | null }[] = [];
  const seen = new Set<string>();

  const addAll = (videos: TikTokVideo[], sourceKeyword: string | null) => {
    ctx.results.videosSearched += videos.length;
    for (const v of videos) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      pool.push({ video: v, sourceKeyword });
    }
  };

  try {
    addAll(await getTikTokTrending({ count: TIKTOK_TRENDING_COUNT }), 'trending');
  } catch (err) {
    console.error('TikTok trending error:', err);
    ctx.results.errors.push('TikTok trending failed');
  }

  // 학습 반영: 적중률 높은 키워드부터. 예산이 끊겨도 성적 좋은 키워드는 이미 돈다.
  const keywords = applyKeywordLearning(getKeywordsForRun(), ctx.rules, CALIBRATION_MODE);
  console.log(`  Keywords this run (${keywords.length}): ${keywords.join(', ')}`);
  for (const kw of keywords) {
    // 수집 단계에도 마감을 둔다 — 여기서 다 써버리면 판정할 시간이 없다
    if (ctx.elapsedMs() > TK_FETCH_DEADLINE_MS) {
      console.log('⏱️ TikTok 검색 budget 초과 — 남은 키워드 스킵');
      ctx.results.partial = true;
      break;
    }
    try {
      addAll(await searchTikTokVideos(kw, { count: TIKTOK_SEARCH_COUNT }), kw);
      await delay(KEYWORD_DELAY_MS);
    } catch (err) {
      console.error(`TikTok search error for "${kw}":`, err);
    }
  }

  // 급상승 순 — 비전 콜을 좋은 후보에 먼저 쓴다
  const vpd = (v: TikTokVideo) =>
    computeViewsPerDay(v.viewCount, v.createTime ? new Date(v.createTime * 1000) : null);
  pool.sort((a, b) => vpd(b.video) - vpd(a.video));
  console.log(`  TikTok pool: ${pool.length} candidates (velocity-sorted)`);

  let collected = 0;
  let evaluated = 0;
  for (const { video, sourceKeyword } of pool) {
    if (ctx.elapsedMs() > TK_DEADLINE_MS) {
      console.log(`⏱️ TikTok 판정 budget 초과 — ${pool.length - evaluated}건 미판정`);
      ctx.results.partial = true;
      break;
    }
    evaluated++;
    if (await processTikTokVideo(ctx, video, sourceKeyword)) collected++;
  }
  ctx.results.candidatesNotEvaluated += pool.length - evaluated;
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

  // 무료 쿼터(30콜/월) 배분 — 하루 1회차만, 해시태그도 로테이션으로 소수만 조회
  if (rapidKey && !isIgRunSlot()) {
    console.log('📷 Instagram: 이 회차는 IG 슬롯 아님 (쿼터 절약) — 스킵');
    return 0;
  }
  console.log(`\n📷 Collecting Instagram Reels (${rapidKey ? 'RapidAPI 해시태그' : 'public API'})...`);

  try {
    let reels: import('@/lib/collectors/instagram-api').InstagramReel[] = [];
    const igErrors: string[] = [];

    if (rapidKey) {
      const tags = pickIgHashtags(IG_BUYINTENT_HASHTAGS);
      console.log(`  IG hashtags this run (${IG_HASHTAGS_PER_RUN}): ${tags.join(', ')}`);
      const r = await collectReelsByHashtags(rapidKey, tags);
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
      // 운영자가 이미 ❌ 를 준 릴 — 재판정은 쿼터 낭비
      if (ctx.rules.rejectedVideoIds.has(`ig_${reel.id}`)) {
        noteSkip(ctx, 'already_rejected');
        continue;
      }

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
        // IG 는 댓글 조회 API 가 없어 수요(§4-A) 미측정 → NO_COMMENTS 플래그로 남는다.
        // 판매링크도 userinfo API 콜(쿼터 소모) 대신 DB 캐시만 본다 — 없으면 가점 7점을
        // 못 받을 뿐. 유료 전환 시 fetchUserInfo 경유로 되돌릴 것.
        fetchSalesLink: async () => {
          const creator = await prisma.creator.findUnique({
            where: {
              platform_authorId: { platform: Platform.INSTAGRAM, authorId: reel.authorId },
            },
          });
          return !!creator?.hasSalesLink;
        },
      };

      const verdict = await evaluateCandidate(candidate, ctx.rules);
      if (!verdict.pass) {
        noteSkip(ctx, verdict.reason);
        continue;
      }
      ctx.processedVideoIds.add(reel.id);
      noteMetrics(ctx, verdict.metrics);

      const igResult = await saveVideo(
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
          sourceKeyword: 'ig_hashtag', // IG 는 해시태그 풀이 합쳐져 개별 태그 추적 불가
        },
        verdict.metrics,
      );
      if (igResult.alert) ctx.alerts.push(igResult.alert);
      if (igResult.saved) collected++;
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
    candidatesNotEvaluated: 0,
    errors: [],
    partial: false,
  };

  // ===== Wall-clock budget =====
  // 종료 주체(Railway 프록시 / GitHub curl 600s)가 무엇이든 그 전에 우리가 먼저
  // 정상 종료하고 200 partial 을 반환한다. 플랫폼별 deadline 으로 슬롯을 나눠
  // 어느 날이든 두 채널 모두 일부는 수집되게 함.
  const startedAt = Date.now();

  // 학습 규칙 로드 — 운영자 라벨(💰/🤔/❌)이 여기서 다음 수집에 반영된다
  const rules = await loadLearnedRules();
  const ctx: CollectCtx = {
    results,
    processedVideoIds: new Set<string>(),
    elapsedMs: () => Date.now() - startedAt,
    rules,
    alerts: [],
  };

  try {
    console.log(
      `\n🎯 Collect start (calibration=${CALIBRATION_MODE}, ` +
        `학습: 라벨 ${rules.labelCount}건 → 차단제품 ${rules.rejectedProductTypes.size} · ` +
        `차단계정 ${rules.rejectedCreators.size} · 검증제품 ${rules.provenProductTypes.size} · ` +
        `벤치키워드 ${rules.benchedKeywords.size} · 학습컷 ${rules.learnedScoreCut ?? '없음'})`,
    );

    console.log('\n🎵 Collecting TikTok videos...');
    const tiktokCollected = await collectTikTok(ctx);
    console.log(`🎵 TikTok: collected ${tiktokCollected} videos`);

    const instagramCollected = await collectInstagram(ctx);

    results.videosCollected = tiktokCollected + instagramCollected;

    // S티어 진입·급상승 알림 — 회차당 1통 (텔레그램 미설정이면 로그만)
    await sendCollectAlerts(ctx.alerts);

    return NextResponse.json({
      success: true,
      calibrationMode: CALIBRATION_MODE,
      learning: {
        labelCount: rules.labelCount,
        rejectedProductTypes: rules.rejectedProductTypes.size,
        rejectedCreators: rules.rejectedCreators.size,
        provenProductTypes: rules.provenProductTypes.size,
        benchedKeywords: rules.benchedKeywords.size,
        learnedScoreCut: rules.learnedScoreCut,
      },
      partial: results.partial,
      alerts: ctx.alerts.length,
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
