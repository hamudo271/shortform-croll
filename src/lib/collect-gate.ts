/**
 * 수집 게이트 v2 — 후보 영상 1건을 받아 통과 여부와 점수를 판정한다.
 * 기준서: docs/COLLECTION_CRITERIA_V2.md (§2 하드필터 → §3 제외 → §4 스코어링)
 *
 * TikTok 트렌딩/키워드/Instagram 세 루프가 모두 이 함수를 쓴다. v1은 루프마다
 * 게이트가 복붙되어 있어 기준이 서로 어긋났었다(키워드 루프만 Gemini 분류 누락 등).
 *
 * 호출 비용 순서가 중요: 로컬 필터 → Gemini 비전(H5 하드필터) → 댓글(점수용) 순으로
 * 진행해 탈락할 영상에 외부 API 를 쓰지 않는다.
 */

import { Platform } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isExcludedContent } from '@/lib/exclude';
import { isListicleTitle } from '@/lib/collectors/tiktok-api';
import { analyzeComments } from '@/lib/comments';
import { analyzeProductThumbnail, type ProductAnalysis } from '@/lib/vision';
import {
  scoreCandidate,
  FLAG_BIG_BRAND,
  FLAG_LARGE,
  FLAG_REGULATED,
  type ScoreBreakdown,
  type Tier,
} from '@/lib/scoring';
import {
  MIN_VIEW_COUNT,
  MIN_VIEWS_PER_DAY,
  MIN_LIKE_RATE,
  RECENCY_WINDOW_DAYS,
  REJECT_MIXED_THUMBNAIL,
  REJECT_LARGE_PRODUCTS,
  REJECT_BIG_BRAND,
  REQUIRE_VISION,
  SCORE_CUT,
  computeViewsPerDay,
} from '@/lib/collect-config';

export interface Candidate {
  platform: Platform;
  authorId: string;
  authorName: string | null;
  title: string;
  description: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  publishedAt: Date | null;
  /**
   * 프로필 판매 링크 조회 — v2에서는 관문이 아니라 §4-D 의 7점 가점이라
   * H5 통과 후에만 호출한다(v1은 모든 후보에 creator API 를 썼음).
   */
  fetchSalesLink?: () => Promise<boolean>;
  /** 댓글 샘플 지연 조회. 마찬가지로 H5 통과 후에만 호출된다. 없으면 수요 미측정 */
  fetchComments?: () => Promise<string[]>;
}

/** 게이트를 통과한 영상에 대해 DB에 저장할 v2 필드 묶음. */
export interface GateMetrics {
  productScore: number;
  tier: Tier;
  scoreBreakdown: ScoreBreakdown;
  flags: string[];
  viewsPerDay: number;
  purchaseIntentScore: number;
  hasPurchaseIntent: boolean;
  visualClass: string | null;
  productType: string | null;
  priceBand: string | null;
  brand: string | null;
}

export type GateResult =
  | { pass: false; reason: string }
  | { pass: true; metrics: GateMetrics };

/** TikTok Shop 연동 흔적 — §4-D 의 "팔리는 물건" 증거. */
const SHOP_TAG_RE = /tiktok\s?shop|shop now|#tiktokshopfinds|link in bio|linkinbio/i;

const MIN_PUBLISHED_AT = () => new Date(Date.now() - RECENCY_WINDOW_DAYS * 86_400_000);

/**
 * 동일 제품을 올린 다른 계정 수 — §4-D 시장 검증 / 포화 판정.
 * Gemini 가 뽑은 일반명(productType)으로 교차 매칭한다.
 */
async function countDuplicateAccounts(
  productType: string | null,
  authorName: string | null,
): Promise<number> {
  if (!productType) return 0;
  try {
    // groupBy 로 집계한다 — findMany + distinct + take 조합은 take 가 중복 제거 전에
    // 걸려 같은 계정 글만 걷어오면 계정 수를 과소 집계할 수 있다.
    const groups = await prisma.video.groupBy({
      by: ['authorName'],
      where: { productType },
    });
    return groups.filter((g) => g.authorName && g.authorName !== authorName).length;
  } catch (err) {
    console.error('countDuplicateAccounts error:', err);
    return 0;
  }
}

/**
 * 후보 1건 판정.
 *
 * 반환이 `pass: false` 면 reason 은 로그/통계용 짧은 코드다.
 * 캘리브레이션 모드에서는 SCORE_CUT=0 이라 점수 미달로는 탈락하지 않는다 —
 * 하드필터만 통과하면 전부 저장하고, 어떤 점수대가 실제 소싱감인지는
 * 운영자 라벨링(Video.userVerdict)으로 역산한다.
 */
export async function evaluateCandidate(candidate: Candidate): Promise<GateResult> {
  const text = `${candidate.title} ${candidate.description}`;

  // ===== H1~H4, H6: 외부 호출 없는 로컬 필터부터 =====
  if (candidate.viewCount < MIN_VIEW_COUNT) return { pass: false, reason: 'low_views' };

  if (!candidate.publishedAt) return { pass: false, reason: 'no_published_at' };
  if (candidate.publishedAt < MIN_PUBLISHED_AT()) return { pass: false, reason: 'too_old' };

  const viewsPerDay = computeViewsPerDay(candidate.viewCount, candidate.publishedAt);
  if (viewsPerDay < MIN_VIEWS_PER_DAY) return { pass: false, reason: 'slow_velocity' };

  const likeRate = candidate.viewCount > 0 ? candidate.likeCount / candidate.viewCount : 0;
  if (likeRate < MIN_LIKE_RATE) return { pass: false, reason: 'low_engagement' };

  // H6: 영어권만 — 라틴 문자가 있어야 하고 한글/비영어권 콘텐츠는 제외
  if (!/[a-zA-Z]{3,}/.test(candidate.title)) return { pass: false, reason: 'no_latin_text' };
  if (/[가-힣]/.test(candidate.title)) return { pass: false, reason: 'korean_content' };
  if (isExcludedContent(text, candidate.authorName || '')) return { pass: false, reason: 'excluded_region' };

  // 다제품 리스티클("10 things you need…")은 단일 제품 발굴에 쓸모없음
  if (isListicleTitle(text)) return { pass: false, reason: 'listicle' };

  // ===== H5 + §3: Gemini 썸네일 분석 (영상당 1콜) =====
  const geminiKey = process.env.GEMINI_API_KEY;
  let analysis: ProductAnalysis | null = null;
  if (geminiKey) {
    analysis = await analyzeProductThumbnail(geminiKey, candidate.thumbnailUrl);
  }

  // 분석 실패(쿼터 429/이미지 fetch 실패) — H5 를 검증할 수 없는 상태.
  // 정식 기준에서는 들이지 않고, 캘리브레이션에서는 NO_VISION 플래그를 달고 통과시킨다.
  if (!analysis && REQUIRE_VISION) return { pass: false, reason: 'vision_unavailable' };

  const extraFlags: string[] = [];
  if (analysis) {
    if (analysis.visualClass === 'face') return { pass: false, reason: 'face_cam' };
    if (REJECT_MIXED_THUMBNAIL && analysis.visualClass === 'mixed') {
      return { pass: false, reason: 'mixed_thumbnail' };
    }
    // H5 — 제품이 주인공이 아니면 탈락 (밈/댄스/일상/서비스). 캘리브레이션에서도 유지:
    // 이게 뚫리면 평가 표본 자체가 오염된다.
    if (!analysis.isPhysicalProduct) return { pass: false, reason: 'not_a_product' };

    if (analysis.isBigBrand || analysis.isLicensedIp) {
      if (REJECT_BIG_BRAND) return { pass: false, reason: 'big_brand' };
      extraFlags.push(FLAG_BIG_BRAND);
    }
    if (analysis.size === 'large') {
      if (REJECT_LARGE_PRODUCTS) return { pass: false, reason: 'too_large' };
      extraFlags.push(FLAG_LARGE);
    }
    if (analysis.isRegulated) extraFlags.push(FLAG_REGULATED);
  }

  // ===== §4-A: 댓글 수요 (H5 통과분만 조회) =====
  let comments: string[] | null = null;
  if (candidate.fetchComments) {
    try {
      comments = await candidate.fetchComments();
    } catch (err) {
      console.error('fetchComments error:', err);
    }
  }

  // §4-D 가점용 판매 링크 — 실패해도 7점만 못 받을 뿐이라 조용히 넘어간다
  let hasSalesLink = false;
  if (candidate.fetchSalesLink) {
    try {
      hasSalesLink = await candidate.fetchSalesLink();
    } catch (err) {
      console.error('fetchSalesLink error:', err);
    }
  }
  const signals = analyzeComments(comments || []);
  const commentsAvailable = signals.sampleSize > 0;

  // ===== §4-D: 시장 검증 =====
  const duplicateAccounts = await countDuplicateAccounts(
    analysis?.productType || null,
    candidate.authorName,
  );

  const score = scoreCandidate({
    viewsPerDay,
    shareRate: candidate.viewCount > 0 ? candidate.shareCount / candidate.viewCount : 0,
    intentRate: signals.intentRate,
    hasPurchaseConfirmation: signals.hasPurchaseConfirmation,
    linkQuestions: signals.linkQuestions,
    commentsAvailable,
    appeal: analysis?.appeal || 'none',
    isCompact: analysis?.size === 'small',
    priceBand: analysis?.priceBand || 'unknown',
    visionAvailable: !!analysis,
    duplicateAccounts,
    hasSalesLink,
    hasShopTag: SHOP_TAG_RE.test(text),
  });

  if (score.total < SCORE_CUT) return { pass: false, reason: 'low_score' };

  return {
    pass: true,
    metrics: {
      productScore: score.total,
      tier: score.tier,
      scoreBreakdown: score.breakdown,
      flags: [...new Set([...score.flags, ...extraFlags])],
      viewsPerDay,
      purchaseIntentScore: signals.intentRate,
      hasPurchaseIntent: signals.intentRate > 0 || signals.hasPurchaseConfirmation,
      visualClass: analysis?.visualClass || null,
      productType: analysis?.productType || null,
      priceBand: analysis?.priceBand || null,
      brand: analysis?.brand || null,
    },
  };
}
