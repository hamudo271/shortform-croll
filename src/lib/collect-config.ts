/**
 * 수집 파이프라인 설정 상수 (collect/route.ts 전용)
 *
 * 여기 값들은 의뢰인 튜닝이 잦은 지점(조회수 하한·최신성·수집 예산·바이럴 점수 구간)이라
 * 라우트 곳곳에 흩어져 있던 매직넘버를 한 곳으로 모은 것이다. **값 자체는 변경하지 않았다.**
 * 튜닝이 필요하면 이 파일만 고치면 된다. env 오버라이드가 필요한 값은 그때 여기에 추가한다.
 */

// 최신성 롤링 컷 — 고정일자 대신 '지금 기준 N일'. 오래된 영상이 '현재 트렌드'로
// 섞이지 않게 (의뢰인: 너무 넓다). 기본 45일.
export const RECENCY_WINDOW_DAYS = Number(process.env.RECENCY_WINDOW_DAYS || 45);

// ===== Wall-clock budget =====
// TikTok 단계는 170s 까지 (YouTube 제거로 슬롯 앞당김).
export const TK_DEADLINE_MS = 170_000;
// 하드캡 520s — GitHub Actions curl --max-time 600 보다 앞서 종료.
// 230s 였을 때 TikTok(170s) + IG 해시태그 fetch(~120s)만으로 초과되어
// IG 릴스 처리 루프가 한 건도 못 돌고 0건 수집되는 문제가 있었음.
export const HARD_BUDGET_MS = 520_000;

// 값싼 1차 필터: 조회수 하한 (TikTok 트렌딩·키워드·IG 릴스 공통)
export const MIN_VIEW_COUNT = 20_000;

// 플랫폼 API 1콜당 요청 건수
export const TIKTOK_TRENDING_COUNT = 30;
export const TIKTOK_SEARCH_COUNT = 30;

// 셀러 검증용 댓글 샘플 수
export const TIKTOK_COMMENT_SAMPLE = 20;

// 키워드 검색 사이 간격 (레이트리밋 완화)
export const KEYWORD_DELAY_MS = 300;

// 바이럴 점수 구간 — 3개 upsert 블록에서 동일하게 쓰이던 ternary 를 함수로.
export function computeViralScore(viewCount: number): number {
  return viewCount > 1_000_000 ? 90 : viewCount > 100_000 ? 60 : 30;
}

// 틱톡 키워드 검색 풀 — 의뢰인 골든 (Daily Sunbeam 도시락, Good Stuff Diary 모션조명,
// CozyPrime 충전기 류)을 잡는 다양한 angle. amazon-중심에서 확장:
// 단일 제품 시연 / 스마트홈 / 실생활 해결 / 가성비 / 신박한 아이디어
export const TIKTOK_KEYWORDS = [
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
