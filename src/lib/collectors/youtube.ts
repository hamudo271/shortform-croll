              /**
 * YouTube Shorts Collector
 * Uses YouTube Data API v3 to fetch trending shorts
 */

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  country?: string;
}

interface YouTubeSearchResult {
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
      channelTitle: string;
      channelId: string;
      publishedAt: string;
    };
  }>;
  nextPageToken?: string;
}

interface YouTubeVideoDetails {
  items: Array<{
    id: string;
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount: string;
    };
    contentDetails: {
      duration: string;
    };
  }>;
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Search for YouTube Shorts (videos under 60 seconds)
 */
export async function searchYouTubeShorts(
  apiKey: string,
  options: {
    query?: string;
    maxResults?: number;
    regionCode?: string;
    keyword?: string;
  } = {}
): Promise<YouTubeVideo[]> {
  // 영어권 시장 타겟 (해외 아이디어템 / 드랍쉬핑 풀)
  const targetRegions = ['US', 'GB', 'CA', 'AU'];
  const defaultRegion = targetRegions[Math.floor(Math.random() * targetRegions.length)];

  const { maxResults = 50, regionCode = defaultRegion, keyword } = options;

  let query = options.query || '#shorts';
  if (keyword) {
    query = keyword;
  } else if (!options.query) {
      // 해외 아이디어템 / TikTokMadeMeBuyIt 장르
      const productQueries = [
        'tiktokmademebuyit', 'amazon finds', 'amazon must haves',
        'cool gadgets', 'kitchen gadgets', 'home gadgets',
        'office gadgets', 'travel gadgets', 'car gadgets',
        'genius inventions', 'cool inventions', 'must have gadgets',
        'lifehack products', 'organization gadgets', 'satisfying products',
        'temu finds', 'aliexpress finds',
        'product review shorts', 'unboxing shorts', 'viral products',
      ];
      query = productQueries[Math.floor(Math.random() * productQueries.length)];
  }

  // Search for videos - 관련성 우선 (상품 검색에 최적화)
  const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('maxResults', String(maxResults));
  searchUrl.searchParams.set('order', 'viewCount'); // 조회수 높은 것 우선
  searchUrl.searchParams.set('regionCode', regionCode);
  searchUrl.searchParams.set('videoDuration', 'short'); // Under 4 minutes
  searchUrl.searchParams.set('publishedAfter', getRecentDate(3)); // Last 3 days (실시간)
  // 영어권 우선 (해외 풀)
  searchUrl.searchParams.set('relevanceLanguage', 'en');
  searchUrl.searchParams.set('key', apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    throw new Error(`YouTube search failed: ${searchRes.statusText}`);
  }

  const searchData: YouTubeSearchResult = await searchRes.json();
  const videoIds = searchData.items.map((item) => item.id.videoId);

  if (videoIds.length === 0) {
    return [];
  }

  // Get video details (statistics)
  const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
  detailsUrl.searchParams.set('part', 'statistics,contentDetails');
  detailsUrl.searchParams.set('id', videoIds.join(','));
  detailsUrl.searchParams.set('key', apiKey);

  const detailsRes = await fetch(detailsUrl.toString());
  if (!detailsRes.ok) {
    throw new Error(`YouTube video details failed: ${detailsRes.statusText}`);
  }

  const detailsData: YouTubeVideoDetails = await detailsRes.json();

  // Filter for actual shorts (under 60 seconds) and merge data
  const statsMap = new Map<string, YouTubeVideoDetails['items'][0]>();
  for (const item of detailsData.items) {
    // Parse ISO 8601 duration (e.g., "PT45S", "PT1M30S")
    const duration = parseDuration(item.contentDetails.duration);
    if (duration <= 60) {
      statsMap.set(item.id, item);
    }
  }

  const videos: YouTubeVideo[] = [];
  const liveKeywords = ['[LIVE]', '라이브', '🔴'];

  const MIN_VIEWS = 10000; // 최소 조회수 1만 이상만 수집

  // 인도/동남아 등 제외 필터 (언어/문자 기반)
  const excludePatterns = [
    // 힌디어/인도
    /[\u0900-\u097F]/, // Devanagari (Hindi)
    /[\u0980-\u09FF]/, // Bengali
    /[\u0A00-\u0A7F]/, // Gurmukhi (Punjabi)
    /[\u0A80-\u0AFF]/, // Gujarati
    /[\u0B00-\u0B7F]/, // Oriya
    /[\u0B80-\u0BFF]/, // Tamil
    /[\u0C00-\u0C7F]/, // Telugu
    /[\u0C80-\u0CFF]/, // Kannada
    /[\u0D00-\u0D7F]/, // Malayalam
    // 태국어
    /[\u0E00-\u0E7F]/, // Thai
    // 베트남어 특수문자
    /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i,
    // 아랍어
    /[\u0600-\u06FF]/, // Arabic
    // 인도네시아/말레이시아 특정 키워드
    /\b(india|indian|hindi|desi|pakistan|bangladesh|tamil|telugu|malayalam|indonesia|vietnamese|thailand|thai|pinoy|filipino)\b/i,
  ];

  for (const item of searchData.items) {
    const stats = statsMap.get(item.id.videoId);
    if (stats) {
      const viewCount = parseInt(stats.statistics.viewCount || '0', 10);
      const title = item.snippet.title;
      const titleUpper = title.toUpperCase();
      const channelTitle = item.snippet.channelTitle;
      const isLive = liveKeywords.some(keyword => titleUpper.includes(keyword.toUpperCase()));

      // 제외 국가 필터 (인도/동남아/아랍권 등)
      const textToCheck = `${title} ${channelTitle}`;
      const isExcludedRegion = excludePatterns.some(pattern => pattern.test(textToCheck));

      // 영어 텍스트가 거의 없으면 제외 (한글/일어/중국어 단독 제외)
      const hasEnglish = /[a-zA-Z]{3,}/.test(title);

      // 최소 조회수 필터 + 라이브 제외 + 제외 국가 필터 + 영어 필수
      if (!isLive && !isExcludedRegion && hasEnglish && viewCount >= MIN_VIEWS) {
        videos.push({
          id: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          // YouTube CDN 직링크 — `i.ytimg.com/vi/<id>/hqdefault.jpg`는 영구 URL이라
          // signed URL 만료 문제가 없음. API 응답의 thumbnails.*.url도 같은 호스트지만
          // 종종 쿼리 파라미터가 붙어 캐시 키가 어긋나므로 표준 형식으로 통일.
          thumbnailUrl: getYouTubeThumbnailUrl(item.id.videoId),
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          viewCount,
          likeCount: parseInt(stats.statistics.likeCount || '0', 10),
          commentCount: parseInt(stats.statistics.commentCount || '0', 10),
          country: regionCode,
        });
      }
    }
  }

  return videos;
}

/**
 * Search shorts by category keywords
 */
export async function searchShortsByCategory(
  apiKey: string,
  category: string
): Promise<YouTubeVideo[]> {
  const categoryKeywords: Record<string, string[]> = {
    // 해외 아이디어템 풀 (영어권)
    GADGETS: ['cool gadgets', 'tiktokmademebuyit', 'amazon finds', 'genius inventions', 'must have gadgets'],
    BEAUTY: ['beauty finds', 'beauty hacks', 'skincare must haves', 'makeup gadgets', 'beauty tools'],
    FASHION: ['fashion finds', 'amazon fashion finds', 'outfit haul', 'fashion accessories', 'shein finds'],
    ELECTRONICS: ['tech gadgets', 'cool tech', 'unboxing shorts', 'tech finds', 'gadget review'],
    HOME: ['home gadgets', 'kitchen gadgets', 'home finds', 'organization gadgets', 'home hacks'],
    FOOD: ['food gadgets', 'kitchen tools', 'food review', 'snack review', 'cooking gadgets'],
    KIDS: ['baby gadgets', 'kids products', 'toy review', 'parenting hacks', 'baby must haves'],
  };

  const keywords = categoryKeywords[category] || [];
  if (keywords.length === 0) {
    return [];
  }

  // Search with random keyword from category
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  return searchYouTubeShorts(apiKey, {
    query: `${randomKeyword} #shorts`,
    maxResults: 20,
  });
}

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get ISO date string for N days ago
 */
function getRecentDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/**
 * Get YouTube video URL
 */
export function getYouTubeVideoUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

/**
 * Get YouTube channel URL
 */
export function getYouTubeChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

/**
 * Permanent YouTube thumbnail URL (no signed params, never expires).
 * `hqdefault.jpg` is 480x360 — works for both regular and Shorts videos.
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
