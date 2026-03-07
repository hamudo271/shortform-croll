/**
 * Google Trends Collector
 * Fetches trending product-related search keywords
 */

// @ts-expect-error - google-trends-api doesn't have types
import googleTrends from 'google-trends-api';

export interface TrendingKeyword {
  keyword: string;
  score: number;
  category: string;
}

// 상품 발굴에 최적화된 시드 키워드
const PRODUCT_SEED_KEYWORDS = {
  BEAUTY: ['화장품 추천', '스킨케어', '올리브영 추천', 'beauty products'],
  FASHION: ['옷 추천', '패션 하울', '악세사리 추천', 'fashion haul'],
  ELECTRONICS: ['가젯 추천', '전자기기 리뷰', '충전기 추천', 'tech gadgets'],
  LIFESTYLE: ['생활용품 추천', '주방용품', '다이소 꿀템', 'home gadgets'],
  FOOD: ['간식 추천', '음식 리뷰', '건강식품', 'snack review'],
  KIDS: ['장난감 추천', '육아템', '아이 선물', 'toy review'],
  HEALTH: ['건강용품', '운동기구 추천', '마사지기', 'fitness gadgets'],
};

/**
 * Get related queries for a seed keyword
 */
async function getRelatedQueries(keyword: string, geo: string = 'KR'): Promise<string[]> {
  try {
    const result = await googleTrends.relatedQueries({
      keyword,
      geo,
      hl: geo === 'KR' ? 'ko' : 'en',
    });

    const data = JSON.parse(result);
    const queries: string[] = [];

    // Rising queries (급상승)
    if (data?.default?.rankedList?.[0]?.rankedKeyword) {
      for (const item of data.default.rankedList[0].rankedKeyword.slice(0, 5)) {
        queries.push(item.query);
      }
    }

    // Top queries (인기)
    if (data?.default?.rankedList?.[1]?.rankedKeyword) {
      for (const item of data.default.rankedList[1].rankedKeyword.slice(0, 5)) {
        queries.push(item.query);
      }
    }

    return [...new Set(queries)]; // Remove duplicates
  } catch (error) {
    console.error(`Error fetching related queries for "${keyword}":`, error);
    return [];
  }
}

/**
 * Get daily trending searches
 */
async function getDailyTrends(geo: string = 'KR'): Promise<string[]> {
  try {
    const result = await googleTrends.dailyTrends({
      geo,
      hl: geo === 'KR' ? 'ko' : 'en',
    });

    const data = JSON.parse(result);
    const trends: string[] = [];

    if (data?.default?.trendingSearchesDays) {
      for (const day of data.default.trendingSearchesDays.slice(0, 2)) {
        for (const search of day.trendingSearches.slice(0, 10)) {
          // 상품 관련 키워드만 필터링
          const title = search.title?.query || '';
          if (isProductRelated(title)) {
            trends.push(title);
          }
        }
      }
    }

    return trends;
  } catch (error) {
    console.error('Error fetching daily trends:', error);
    return [];
  }
}

/**
 * Check if keyword is product-related
 */
function isProductRelated(keyword: string): boolean {
  const productIndicators = [
    '추천', '리뷰', '하울', '언박싱', '구매', '가격', '할인',
    '신상', '신제품', '출시', '브랜드', '제품',
    'review', 'haul', 'unboxing', 'buy', 'product', 'brand',
    '화장품', '옷', '가방', '신발', '전자', '가전', '식품',
  ];

  const lowerKeyword = keyword.toLowerCase();
  return productIndicators.some((indicator) => lowerKeyword.includes(indicator));
}

/**
 * Collect trending product keywords from Google Trends
 */
export async function collectTrendingKeywords(
  options: {
    categories?: string[];
    geo?: string;
    maxKeywords?: number;
  } = {}
): Promise<TrendingKeyword[]> {
  const {
    categories = Object.keys(PRODUCT_SEED_KEYWORDS),
    geo = 'KR',
    maxKeywords = 30,
  } = options;

  const allKeywords: TrendingKeyword[] = [];

  // 1. Get daily trending searches (product-related only)
  const dailyTrends = await getDailyTrends(geo);
  for (const trend of dailyTrends) {
    allKeywords.push({
      keyword: trend,
      score: 100, // Daily trends get highest score
      category: 'TRENDING',
    });
  }

  // 2. Get related queries for each category seed keyword
  for (const category of categories) {
    const seedKeywords = PRODUCT_SEED_KEYWORDS[category as keyof typeof PRODUCT_SEED_KEYWORDS] || [];

    for (const seed of seedKeywords.slice(0, 2)) { // Limit to 2 seeds per category
      const related = await getRelatedQueries(seed, geo);

      for (const keyword of related) {
        allKeywords.push({
          keyword,
          score: 80,
          category,
        });
      }

      // Rate limiting - Google Trends has strict limits
      await delay(500);
    }
  }

  // Remove duplicates and limit results
  const uniqueKeywords = removeDuplicateKeywords(allKeywords);
  return uniqueKeywords.slice(0, maxKeywords);
}

/**
 * Get YouTube search queries optimized for product discovery
 */
export async function getProductSearchQueries(
  options: {
    category?: string;
    geo?: string;
    count?: number;
  } = {}
): Promise<string[]> {
  const { category, geo = 'KR', count = 10 } = options;

  const keywords = await collectTrendingKeywords({
    categories: category ? [category] : undefined,
    geo,
    maxKeywords: count * 2,
  });

  // Transform keywords into YouTube search queries
  const queries = keywords.map((kw) => {
    // Add product-related suffixes for better YouTube results
    const suffixes = ['shorts', '추천', '리뷰', 'unboxing'];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${kw.keyword} ${suffix}`;
  });

  return queries.slice(0, count);
}

/**
 * Remove duplicate keywords (case-insensitive)
 */
function removeDuplicateKeywords(keywords: TrendingKeyword[]): TrendingKeyword[] {
  const seen = new Set<string>();
  return keywords.filter((kw) => {
    const lower = kw.keyword.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
