/**
 * Smart Trend Collector for Dropshipping Product Discovery
 *
 * Strategy:
 * 1. Google Trends - 실시간 급상승 상품 키워드
 * 2. YouTube Trending - 바이럴 상품 영상 (24시간 내)
 * 3. 드랍쉬핑 특화 채널 모니터링
 */

// @ts-expect-error - google-trends-api doesn't have types
import googleTrends from 'google-trends-api';

// 드랍쉬핑 상품 발굴에 특화된 글로벌 채널들
const DROPSHIPPING_CHANNELS = [
  // 영어권 바이럴 상품 채널
  'UCkQO3QsgTpNTsOw6ujimT5Q', // Unbox Therapy
  'UCsTcErHg8oDvUnTzoqsYeNw', // Mrwhosetheboss
  'UC0RhatS1pyxInC00YKjjBqQ', // Gadget Zone
];

// 한국 인스타 세일즈 바이럴 키워드
const VIRAL_PRODUCT_KEYWORDS = {
  global: [] as string[],
  korean: [
    // 인스타 바이럴
    '인스타 바이럴 제품',
    '인스타 광고 제품 리뷰',
    '인스타 릴스 추천템',
    '인스타 쇼핑 추천',
    '인스타 핫한 제품',
    // 뷰티/화장품 (인스타 세일즈 핵심)
    '올리브영 추천',
    '올리브영 신상',
    '화장품 추천 shorts',
    '스킨케어 추천',
    '뷰티템 리뷰',
    '메이크업 추천',
    '향수 추천',
    // 패션/악세사리
    '데일리룩 추천',
    '패션 하울',
    '악세사리 추천',
    '가방 추천',
    '신발 추천',
    // 리빙/라이프스타일
    '다이소 꿀템',
    '생활용품 추천',
    '주방용품 추천',
    '인테리어 소품',
    '홈카페 용품',
    // 쇼핑 전반
    '쿠팡 추천템',
    '알리 추천템',
    '가성비 꿀템',
    '쇼핑하울',
    '언박싱 리뷰',
    '편의점 신상',
    // 건강/식품
    '건강식품 추천',
    '다이어트 식품',
    '영양제 추천',
    // 전자기기
    '가젯 추천',
    '전자기기 리뷰',
    '폰케이스 추천',
  ],
};

export interface TrendingProduct {
  keyword: string;
  category: string;
  trendScore: number; // 0-100, Google Trends score
  isRising: boolean;  // 급상승 여부
  relatedQueries: string[];
}

export interface ProductVideoResult {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
  viewCount: number;
  publishedAt: string;
  engagementScore: number; // likes/views ratio
  trendKeyword: string;
}

/**
 * Google Trends에서 실시간 급상승 상품 키워드 가져오기
 */
export async function getRisingProductTrends(geo: string = 'US'): Promise<TrendingProduct[]> {
  const trends: TrendingProduct[] = [];

  // 상품 카테고리별 시드 키워드
  const seedKeywords = [
    'viral products',
    'amazon finds',
    'tiktok products',
    'gadgets',
    'beauty products',
  ];

  for (const seed of seedKeywords) {
    try {
      // Related queries - 급상승 검색어 찾기
      const relatedResult = await googleTrends.relatedQueries({
        keyword: seed,
        geo,
        hl: 'en',
        category: 0, // All categories
      });

      const data = JSON.parse(relatedResult);

      // Rising queries (급상승) - 가장 중요
      const risingQueries = data?.default?.rankedList?.[0]?.rankedKeyword || [];
      for (const item of risingQueries.slice(0, 5)) {
        trends.push({
          keyword: item.query,
          category: seed,
          trendScore: item.value || 0,
          isRising: true,
          relatedQueries: [],
        });
      }

      await delay(300); // Rate limiting
    } catch (error) {
      console.error(`Error fetching trends for "${seed}":`, error);
    }
  }

  // 중복 제거 및 점수순 정렬
  const uniqueTrends = removeDuplicates(trends);
  return uniqueTrends.sort((a, b) => b.trendScore - a.trendScore);
}

/**
 * 실시간 인기 상품 검색어 (Google Trends Daily)
 */
export async function getDailyTrendingProducts(geo: string = 'US'): Promise<string[]> {
  try {
    const result = await googleTrends.dailyTrends({
      geo,
      hl: 'en',
    });

    const data = JSON.parse(result);
    const products: string[] = [];

    // 오늘과 어제 트렌드
    const days = data?.default?.trendingSearchesDays?.slice(0, 2) || [];

    for (const day of days) {
      for (const search of day.trendingSearches || []) {
        const title = search.title?.query || '';
        // 상품 관련 키워드만 필터링
        if (isProductRelated(title)) {
          products.push(title);
        }
      }
    }

    return products.slice(0, 20);
  } catch (error) {
    console.error('Error fetching daily trends:', error);
    return [];
  }
}

/**
 * 특정 키워드의 최근 관심도 확인
 */
export async function getInterestOverTime(keyword: string): Promise<number> {
  try {
    const result = await googleTrends.interestOverTime({
      keyword,
      geo: 'US',
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7일 전
    });

    const data = JSON.parse(result);
    const timeline = data?.default?.timelineData || [];

    if (timeline.length === 0) return 0;

    // 최근 값과 평균 비교해서 트렌드 점수 계산
    const recent = timeline.slice(-3).reduce((sum: number, t: { value: number[] }) => sum + (t.value?.[0] || 0), 0) / 3;
    const average = timeline.reduce((sum: number, t: { value: number[] }) => sum + (t.value?.[0] || 0), 0) / timeline.length;

    // 급상승 중이면 높은 점수
    return average > 0 ? Math.round((recent / average) * 50) : 0;
  } catch {
    return 0;
  }
}

/**
 * 드랍쉬핑 상품 키워드 조합 생성
 */
export function generateSearchQueries(trends: TrendingProduct[]): string[] {
  const queries: string[] = [];

  // 1. 급상승 트렌드 기반 쿼리
  for (const trend of trends.slice(0, 10)) {
    queries.push(`${trend.keyword} review shorts`);
    queries.push(`${trend.keyword} unboxing`);
  }

  // 2. 고정 바이럴 키워드
  queries.push(...VIRAL_PRODUCT_KEYWORDS.global.slice(0, 5));

  // 3. 한국어 키워드 (한국 시장)
  queries.push(...VIRAL_PRODUCT_KEYWORDS.korean.slice(0, 3));

  return [...new Set(queries)]; // 중복 제거
}

/**
 * 상품 관련 키워드인지 판단
 */
function isProductRelated(text: string): boolean {
  const productIndicators = [
    'product', 'buy', 'amazon', 'aliexpress', 'gadget', 'device',
    'review', 'unboxing', 'haul', 'best', 'top', 'viral',
    'phone', 'case', 'charger', 'headphone', 'earbuds',
    'kitchen', 'home', 'beauty', 'skincare', 'makeup',
    'tech', 'accessory', 'tool', 'gift',
  ];

  const lower = text.toLowerCase();
  return productIndicators.some(indicator => lower.includes(indicator));
}

/**
 * 중복 제거
 */
function removeDuplicates(trends: TrendingProduct[]): TrendingProduct[] {
  const seen = new Set<string>();
  return trends.filter(t => {
    const key = t.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export channel IDs for monitoring
export { DROPSHIPPING_CHANNELS, VIRAL_PRODUCT_KEYWORDS };
