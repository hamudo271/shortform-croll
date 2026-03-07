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
  // Randomly select between target regions (US, KR, JP) for broader trend coverage
  const targetRegions = ['US', 'KR', 'JP'];
  const defaultRegion = targetRegions[Math.floor(Math.random() * targetRegions.length)];

  const { maxResults = 50, regionCode = defaultRegion, keyword } = options;

  let query = options.query || '#shorts';
  if (keyword) {
    query = keyword;
  } else if (!options.query) {
      // 상품 발굴에 최적화된 검색어 (유통업 목적)
      const productQueries = [
        // 한국 상품 트렌드
        '틱톡템 추천', '다이소 꿀템', '쿠팡 추천템', '올리브영 추천',
        '쇼핑하울 shorts', '언박싱 추천', '아이디어상품 리뷰',
        '생활용품 추천', '주방용품 추천', '인테리어 소품',
        // 글로벌 상품 트렌드
        'tiktokmademebuyit', 'amazon finds', 'aliexpress haul',
        'viral products 2024', 'gadget review shorts', 'unboxing haul',
        'must have products', 'kitchen gadgets viral', 'home gadgets',
        // 카테고리별 상품
        '화장품 추천 shorts', '패션 하울', '전자기기 리뷰',
        '폰케이스 추천', '악세사리 하울', '가방 추천'
      ];
      query = productQueries[Math.floor(Math.random() * productQueries.length)];
  }

  // Search for videos
  const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('maxResults', String(maxResults));
  searchUrl.searchParams.set('order', 'viewCount');
  searchUrl.searchParams.set('regionCode', regionCode);
  searchUrl.searchParams.set('videoDuration', 'short'); // Under 4 minutes
  searchUrl.searchParams.set('publishedAfter', getRecentDate(7)); // Last 7 days
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

  for (const item of searchData.items) {
    const stats = statsMap.get(item.id.videoId);
    if (stats) {
      const title = item.snippet.title.toUpperCase();
      const isLive = liveKeywords.some(keyword => title.includes(keyword.toUpperCase()));
      
      if (!isLive) {
        videos.push({
          id: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl:
            item.snippet.thumbnails.high?.url ||
            item.snippet.thumbnails.medium?.url ||
            item.snippet.thumbnails.default?.url ||
            '',
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          viewCount: parseInt(stats.statistics.viewCount || '0', 10),
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
    // 유통업 상품 발굴용 키워드 (상품 중심)
    GADGETS: ['아이디어상품 추천', '꿀템 리뷰', '틱톡템', 'tiktokmademebuyit', '생활용품 추천'],
    BEAUTY: ['화장품 추천', '올리브영 하울', '스킨케어 추천', '뷰티템 리뷰', 'beauty haul'],
    FASHION: ['옷 하울', '패션 추천템', '악세사리 추천', 'fashion haul', 'outfit haul'],
    ELECTRONICS: ['전자기기 리뷰', '가젯 추천', 'tech gadget', 'unboxing shorts', '충전기 추천'],
    HOME: ['주방용품 추천', '인테리어 소품', '생활용품 하울', 'home gadgets', 'kitchen gadgets'],
    FOOD: ['식품 추천', '간식 추천', '음료 리뷰', '먹거리 추천', 'food review'],
    KIDS: ['육아템 추천', '장난감 리뷰', '유아용품', 'toy review', 'kids gadgets'],
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
