/**
 * 수집 기준 v2 파라미터 — "위닝 프로덕트 발굴" 기준서의 구현체.
 * 기준 문서: docs/COLLECTION_CRITERIA_V2.md (§8 파라미터 표와 1:1 대응)
 *
 * v1과의 핵심 차이: 판매자 계정(bio 링크·영상 수)을 관문으로 쓰지 않는다.
 * 판매자가 이미 붙은 제품 = 포화된 제품이라 소싱 가치가 낮기 때문. 대신
 * 속도(viewsPerDay) + 댓글 수요 + 제품성으로 점수를 매겨 티어로 줄 세운다.
 *
 * Phase 0(캘리브레이션): CALIBRATION_MODE=true 면 문턱을 낮춰 대량 수집하고,
 * 운영자 라벨링(Video.userVerdict) 분포로 임계값을 보정한 뒤 정식값으로 전환한다.
 */

/**
 * Phase 0 캘리브레이션 모드. 기본 ON — 라벨링 데이터가 쌓여 임계값을 확정하면
 * Railway 환경변수 CALIBRATION_MODE=false 로 정식 기준 전환(재배포 불필요).
 */
export const CALIBRATION_MODE = process.env.CALIBRATION_MODE !== 'false';

/** 정식값 / 캘리브레이션 완화값 중 현재 모드에 맞는 쪽을 고른다. */
function tuned<T>(strictValue: T, calibrationValue: T): T {
  return CALIBRATION_MODE ? calibrationValue : strictValue;
}

/** env 오버라이드 — 빈 문자열/NaN 이면 fallback (v1의 `Number(env || x)` 버그 회피). */
function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// ===== 하드 필터 (전부 통과해야 스코어링 단계로) =====

/**
 * H1 최신성 — 위닝 프로덕트는 수명이 짧다. 정식 30일.
 * 캘리브레이션은 90일: 첫 수집에서 탈락 사유 1위가 too_old(76건)였고, tikwm 검색이
 * 최신순으로 주지 않아 60일로는 표본이 안 모였다.
 */
export const RECENCY_WINDOW_DAYS = envNum('RECENCY_WINDOW_DAYS', tuned(30, 90));

/** H2 조회 속도 — 절대 조회수 대신 이게 트렌드의 본질. viewCount ÷ 경과일수. */
export const MIN_VIEWS_PER_DAY = envNum('MIN_VIEWS_PER_DAY', tuned(10_000, 2_000));

/** H3 최소 조회수 — 업로드 1일차 과대평가 방지용 노이즈 컷 (H2와 AND). */
export const MIN_VIEW_COUNT = envNum('MIN_VIEW_COUNT', tuned(30_000, 10_000));

/** H4 참여율 — 뷰 어뷰징/광고 도달빨 제거. likeCount ÷ viewCount. */
export const MIN_LIKE_RATE = envNum('MIN_LIKE_RATE', tuned(0.03, 0.01));

/**
 * H5 제품 노출 — 썸네일 주 피사체가 물리적 제품이어야 한다.
 * 'face'(얼굴 위주)는 항상 거부. 'mixed'(얼굴+제품)는 정식 기준에서만 거부하고
 * 캘리브레이션 중에는 통과시킨다 — mixed 가 쓸만한지 자체가 라벨링 검증 대상.
 */
export const REJECT_MIXED_THUMBNAIL = tuned(true, false);

/** 대형/중량물(가구·대형가전)은 물류비로 마진이 붕괴 — 정식 기준에서만 컷. */
export const REJECT_LARGE_PRODUCTS = tuned(true, false);

/** 빅브랜드·라이선스 IP 제품은 소싱 불가 — 정식 기준에서만 컷, Phase 0 은 플래그만. */
export const REJECT_BIG_BRAND = tuned(true, false);

/**
 * Gemini 분석 실패(쿼터 429 등) 시 처리.
 * 정식 기준: H5(제품 여부)를 검증 못 했으면 들이지 않는다.
 * 캘리브레이션: NO_VISION 플래그만 달고 수집 — 그런 표본이 실제로 쓸모없는지도
 * 운영자 라벨링으로 판단할 대상이다.
 */
export const REQUIRE_VISION = tuned(true, false);

// ===== 스코어링 (100점 만점) =====

/** A 수요 35점 — 댓글 샘플 기준. */
export const INTENT_RATE_HIGH = 25; // % 이상 → 15점 (v1은 30%를 관문으로 썼음)
export const INTENT_RATE_MID = 10; // % 이상 → 8점
export const MIN_LINK_QUESTIONS = 3; // "link?" 류 직접 질문 N건 이상 → +10점
export const COMMENT_SAMPLE = 30; // v1: 20

/** B 확산 속도 25점. */
export const VELOCITY_HIGH = 100_000; // views/day 이상 → 15점
export const VELOCITY_MID = 30_000; // → 10점
export const VELOCITY_LOW = 10_000; // → 5점
export const SHARE_RATE_BONUS = 0.005; // shareCount ÷ viewCount 이상 → +10점

/** C 제품성 25점 — 소비자가 $10~$60 = 충동구매 + 유통 마진 확보 구간. */
export const PRICE_BAND_USD: [number, number] = [10, 60];

/** D 시장 검증 15점 — 동일 제품 게시 계정 수. */
export const MIN_DUPLICATE_ACCOUNTS = 2; // 이상 → 8점 (팔리는 물건이라는 증거)
export const SATURATION_ACCOUNT_COUNT = 10; // 이상 → 포화. D점수 0 + SATURATED 플래그

/** 티어 컷. */
export const TIER_S = 75;
export const TIER_A = 60;
export const TIER_B = 45;

/**
 * 저장 최소 점수. 캘리브레이션 중에는 0 — 점수는 계산해서 저장하되 게이트로는
 * 쓰지 않는다. 라벨링 후 "몇 점부터가 실제 소싱감인가"를 역산하기 위함.
 */
export const SCORE_CUT = tuned(TIER_B, 0);

/** 캘리브레이션 1회 수집 목표치 — 평가 가능한 분량. */
export const CALIBRATION_TARGET_COUNT = 300;

// ===== Wall-clock budget =====

/**
 * TikTok "검색" 마감 — 후보를 긁어모으는 단계는 여기서 끊는다.
 * 검색은 싸고 판정은 비싸므로(영상당 Gemini 1콜, 무료 티어 분당 10회)
 * 수집에 시간을 다 쓰면 정작 판정을 못 한다.
 */
export const TK_FETCH_DEADLINE_MS = envNum('TK_FETCH_DEADLINE_MS', 60_000);

/** TikTok "판정" 마감 — 이후는 Instagram 슬롯. */
export const TK_DEADLINE_MS = envNum('TK_DEADLINE_MS', 220_000);

/**
 * 전체 하드캡. 우리를 끊을 수 있는 주체 중 가장 빠른 것보다 먼저 끝나야 한다:
 *   - Cloudflare(커스텀 도메인 smartrend.co.kr) ~100s → 524. 그래서 수집 트리거는
 *     반드시 Railway 원본 도메인(*.up.railway.app)으로 호출한다.
 *   - GitHub Actions 의 `curl --max-time 600`
 * Gemini 호출 간격 제어(7s/건)가 들어간 뒤로 실제로 길게 도는 경로가 생겨서
 * 520s → 280s 로 낮췄다. 여유를 두고 프록시 한계 아래를 유지한다.
 */
export const HARD_BUDGET_MS = envNum('HARD_BUDGET_MS', 280_000);

/** 키워드 검색 간 간격 — tikwm 레이트리밋 완화. */
export const KEYWORD_DELAY_MS = 300;

// ===== 검색 키워드 (구매자 관점) =====

/**
 * v1은 판매자 관점 키워드('i bought this', 'small business products')가 많아
 * 셀러 홍보 영상이 주로 걸렸다. v2는 구매자가 모이는 해시태그 중심.
 */

/** 매 수집마다 도는 핵심 해시태그. */
export const CORE_KEYWORDS = [
  'tiktokmademebuyit',
  'amazonfinds',
  'founditonamazon',
  'tiktokshopfinds',
  'viralproducts',
  'musthaves',
];

/**
 * 카테고리 로테이션 — 회차별로 한 묶음씩 순환한다.
 * 매번 전부 돌면 tikwm 레이트리밋과 wall-clock budget 을 둘 다 초과하므로,
 * 넓게 훑되 한 회차의 비용은 일정하게 유지하기 위한 구조.
 */
export const CATEGORY_KEYWORD_GROUPS: string[][] = [
  ['kitchengadgets', 'kitchenfinds', 'cookinghacks'],
  ['cleaningtok', 'cleaninghacks', 'homeorganization'],
  ['caraccessories', 'cargadgets'],
  ['petgadgets', 'petmusthaves'],
  ['beautygadgets', 'hairtools'],
  ['homefinds', 'roomdecor', 'ledlights'],
];

/** 계절 슬롯 — 분기별 1~2개 교체. 월(0-11) 기준. */
const SEASONAL_KEYWORDS: Record<number, string[]> = {
  0: ['wintergadgets'], 1: ['wintergadgets'],
  2: ['springcleaning'], 3: ['springcleaning'], 4: ['coolinggadgets'],
  5: ['coolinggadgets', 'beachessentials'], 6: ['coolinggadgets', 'beachessentials'], 7: ['beachessentials'],
  8: ['backtoschoolfinds'], 9: ['halloweenfinds'],
  10: ['giftideas'], 11: ['giftideas', 'heatedproducts'],
};

/**
 * 이번 회차에 검색할 키워드 목록.
 *
 * 정식 기준에서는 카테고리를 한 묶음씩 순환한다 — 로테이션 인덱스는
 * "연중 일수 × 하루 수집 횟수(4회)" 기준이라 하루 4번이 서로 다른 카테고리를 훑는다.
 *
 * 캘리브레이션에서는 전 카테고리를 한 번에 돈다. 첫 실측에서 8.6분 예산 중 2분만
 * 쓰고 끝났다(예산이 아니라 tikwm 공급이 병목) — 표본 확보가 우선이라 넓게 훑는다.
 */
export function getKeywordsForRun(now: Date = new Date()): string[] {
  const seasonal = SEASONAL_KEYWORDS[now.getMonth()] || [];

  if (CALIBRATION_MODE) {
    return [...CORE_KEYWORDS, ...CATEGORY_KEYWORD_GROUPS.flat(), ...seasonal];
  }

  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const slot = dayOfYear * 4 + Math.floor(now.getUTCHours() / 6);
  const group = CATEGORY_KEYWORD_GROUPS[slot % CATEGORY_KEYWORD_GROUPS.length];
  return [...CORE_KEYWORDS, ...group, ...seasonal];
}

// ===== 기타 =====

/** 회차당 검색 건수. */
export const TIKTOK_TRENDING_COUNT = 30;
export const TIKTOK_SEARCH_COUNT = 30;

/**
 * viralScore — 기존 대시보드 정렬에 쓰이는 값이라 계산식 유지.
 * v2 의 productScore(0-100)와는 별개 지표.
 */
export function computeViralScore(viewCount: number): number {
  return viewCount > 1_000_000 ? 90 : viewCount > 100_000 ? 60 : 30;
}

/** 업로드 시각 → 일 평균 조회수. 24시간 미만은 1일로 취급(과대평가 방지). */
export function computeViewsPerDay(viewCount: number, publishedAt: Date | null): number {
  if (!publishedAt) return 0;
  const days = Math.max(1, (Date.now() - publishedAt.getTime()) / 86_400_000);
  return Math.round(viewCount / days);
}
