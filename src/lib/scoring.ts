/**
 * 위닝 프로덕트 스코어링 v2 — 기준서 docs/COLLECTION_CRITERIA_V2.md §4 구현.
 *
 * 하드 필터를 통과한 후보에 100점을 매겨 S/A/B 티어로 줄 세운다.
 *   A 수요 35 (댓글) + B 속도 25 + C 제품성 25 + D 시장검증 15
 *
 * 설계 의도: v1은 "판매 링크 있음"을 관문으로 썼지만, 그건 이미 셀러가 붙었다는
 * 뜻이라 소싱 기회로는 늦다. v2에서 판매 링크는 D의 7점짜리 가점일 뿐이고,
 * 수요(A)가 터졌는데 아직 판매자가 없는 제품이 최상급 매물이 되도록 배점했다.
 */

import {
  INTENT_RATE_HIGH,
  INTENT_RATE_MID,
  MIN_LINK_QUESTIONS,
  VELOCITY_HIGH,
  VELOCITY_MID,
  VELOCITY_LOW,
  SHARE_RATE_BONUS,
  MIN_DUPLICATE_ACCOUNTS,
  SATURATION_ACCOUNT_COUNT,
  TIER_S,
  TIER_A,
  TIER_B,
} from '@/lib/collect-config';

export type Tier = 'S' | 'A' | 'B' | null;
export type PriceBand = 'under_10' | '10_60' | 'over_60' | 'unknown';
export type ProductAppeal = 'problem_solver' | 'wow' | 'none';

/** 저장되는 플래그 — 제외가 아니라 표기용(기준서 §7). */
export const FLAG_REGULATED = 'REGULATED'; // 인증(KC/전파/식약처) 필요 — 소싱은 가능하나 비용·기간 고려
export const FLAG_SATURATED = 'SATURATED'; // 동일 제품 게시 계정 10+ — 늦음
export const FLAG_BIG_BRAND = 'BIG_BRAND'; // 빅브랜드/라이선스 IP — 유통 마진 구조상 소싱 불가
export const FLAG_LARGE = 'LARGE'; // 대형/중량물 — 물류비로 마진 붕괴
export const FLAG_NO_VISION = 'NO_VISION'; // Gemini 분석 실패 — 제품성 점수 미측정
export const FLAG_NO_COMMENTS = 'NO_COMMENTS'; // 댓글 미수집(IG) — 수요 점수 미측정

export interface ScoreInput {
  /** B: 일 평균 조회수 */
  viewsPerDay: number;
  /** B: shareCount ÷ viewCount */
  shareRate: number;
  /** A: 구매의도 댓글 비율 0-100. 댓글 미수집이면 commentsAvailable=false */
  intentRate: number;
  /** A: "just ordered" 류 구매확정 표현 존재 — 의도보다 강한 신호 */
  hasPurchaseConfirmation: boolean;
  /** A: "link?" / "where to buy" 류 직접 질문 건수 */
  linkQuestions: number;
  /** A: 댓글 샘플을 실제로 받아왔는지 (IG는 댓글 API 없음, tikwm 은 빈 배열 반환 중) */
  commentsAvailable: boolean;
  /** A 대체: commentCount ÷ viewCount. 댓글 본문을 못 볼 때의 축소 측정치 */
  commentRate: number;
  /** C: 문제해결형/Wow-factor형 여부 */
  appeal: ProductAppeal;
  /** C: 소형·경량 (소량 수입 가능해 보이는지) */
  isCompact: boolean;
  /** C: 추정 소비자가 구간 */
  priceBand: PriceBand;
  /** C: Gemini 분석 성공 여부 */
  visionAvailable: boolean;
  /** D: 동일 제품을 올린 다른 계정 수 */
  duplicateAccounts: number;
  /** D: 프로필에 판매 링크 존재 */
  hasSalesLink: boolean;
  /** D: TikTok Shop 태그 존재 */
  hasShopTag: boolean;
}

export interface ScoreBreakdown {
  demand: number; // /35
  velocity: number; // /25
  product: number; // /25
  market: number; // /15
  /** 측정 불가 항목을 제외하고 환산했을 때의 만점 (정규화 근거) */
  measurableMax: number;
}

export interface ScoreResult {
  /** 0-100 정규화 점수 */
  total: number;
  breakdown: ScoreBreakdown;
  tier: Tier;
  flags: string[];
}

const MAX_DEMAND = 35;
const MAX_VELOCITY = 25;
const MAX_PRODUCT = 25;
const MAX_MARKET = 15;

/**
 * 댓글 본문을 못 읽을 때의 대체 측정 — 댓글 비율(commentCount÷viewCount).
 * "무슨 말을 하는지"는 모르지만 "말이 많이 붙었는지"는 알 수 있다.
 * 본문 분석(35점)보다 훨씬 약한 신호라 만점을 12점으로 낮춰 잡는다.
 */
const MAX_DEMAND_PROXY = 12;

/**
 * 측정된 항목의 합이 이 미만이면 티어를 붙이지 않는다.
 * 속도와 시장검증(40점)만 보고 "S급"이라고 부르면 그 라벨이 거짓말이 된다 —
 * 제품을 본 적도 없이 위닝 프로덕트라고 말할 수는 없다.
 */
const MIN_TIER_COVERAGE = 60;

/** A. 수요 신호 — 35점 */
function scoreDemand(i: ScoreInput): number {
  if (!i.commentsAvailable) return 0;
  let s = 0;
  if (i.intentRate >= INTENT_RATE_HIGH) s += 15;
  else if (i.intentRate >= INTENT_RATE_MID) s += 8;
  if (i.hasPurchaseConfirmation) s += 10;
  if (i.linkQuestions >= MIN_LINK_QUESTIONS) s += 10;
  return Math.min(s, MAX_DEMAND);
}

/** B. 확산 속도 — 25점 */
function scoreVelocity(i: ScoreInput): number {
  let s = 0;
  if (i.viewsPerDay >= VELOCITY_HIGH) s += 15;
  else if (i.viewsPerDay >= VELOCITY_MID) s += 10;
  else if (i.viewsPerDay >= VELOCITY_LOW) s += 5;
  if (i.shareRate >= SHARE_RATE_BONUS) s += 10;
  return Math.min(s, MAX_VELOCITY);
}

/** C. 제품성 — 25점 */
function scoreProduct(i: ScoreInput): number {
  if (!i.visionAvailable) return 0;
  let s = 0;
  if (i.appeal === 'problem_solver' || i.appeal === 'wow') s += 12;
  if (i.isCompact) s += 7;
  if (i.priceBand === '10_60') s += 6;
  return Math.min(s, MAX_PRODUCT);
}

/** D. 시장 검증 — 15점. 포화(계정 10+)면 0점 처리. */
function scoreMarket(i: ScoreInput): number {
  if (i.duplicateAccounts >= SATURATION_ACCOUNT_COUNT) return 0;
  let s = 0;
  if (i.duplicateAccounts >= MIN_DUPLICATE_ACCOUNTS) s += 8;
  if (i.hasSalesLink || i.hasShopTag) s += 7;
  return Math.min(s, MAX_MARKET);
}

/**
 * 최종 점수.
 *
 * 측정 불가 항목(IG의 댓글, Gemini 실패 시 제품성)은 0점으로 두면 플랫폼 간
 * 비교가 불공정해지므로, 측정 가능한 항목만의 만점으로 100점 환산한다.
 * 어떤 항목이 빠졌는지는 flags(NO_COMMENTS/NO_VISION)로 남겨 캘리브레이션 때
 * "IG 점수가 낮은 게 실제 품질 탓인지 측정 공백 탓인지" 구분할 수 있게 한다.
 */
export function scoreCandidate(input: ScoreInput): ScoreResult {
  const velocity = scoreVelocity(input);
  const product = scoreProduct(input);
  const market = scoreMarket(input);

  // 댓글 본문을 못 읽으면 댓글 비율로 축소 측정 (만점도 12점으로 낮춤)
  const demand = input.commentsAvailable ? scoreDemand(input) : scoreDemandProxy(input.commentRate);
  const demandMax = input.commentsAvailable ? MAX_DEMAND : MAX_DEMAND_PROXY;

  let measurableMax = MAX_VELOCITY + MAX_MARKET + demandMax;
  if (input.visionAvailable) measurableMax += MAX_PRODUCT;

  const raw = demand + velocity + product + market;
  const total = measurableMax > 0 ? Math.round((raw / measurableMax) * 100) : 0;

  const flags: string[] = [];
  if (!input.commentsAvailable) flags.push(FLAG_NO_COMMENTS);
  if (!input.visionAvailable) flags.push(FLAG_NO_VISION);
  if (input.duplicateAccounts >= SATURATION_ACCOUNT_COUNT) flags.push(FLAG_SATURATED);

  // 측정 공백이 크면 점수는 남기되 티어는 붙이지 않는다
  const tier = measurableMax >= MIN_TIER_COVERAGE ? toTier(total) : null;

  return { total, breakdown: { demand, velocity, product, market, measurableMax }, tier, flags };
}

function scoreDemandProxy(commentRate: number): number {
  if (commentRate >= 0.01) return 12;
  if (commentRate >= 0.005) return 7;
  if (commentRate >= 0.002) return 3;
  return 0;
}

export function toTier(total: number): Tier {
  if (total >= TIER_S) return 'S';
  if (total >= TIER_A) return 'A';
  if (total >= TIER_B) return 'B';
  return null;
}
