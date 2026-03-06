/**
 * YouTube Shorts Collector
 * Uses YouTube Data API v3 to fetch trending shorts
 */

interface YouTubeVideo {
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
  } = {}
): Promise<YouTubeVideo[]> {
  const { query = '#shorts', maxResults = 50, regionCode = 'KR' } = options;

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
  for (const item of searchData.items) {
    const stats = statsMap.get(item.id.videoId);
    if (stats) {
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
      });
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
    BEAUTY: ['뷰티', '메이크업', '화장품', '스킨케어', 'beauty', 'makeup'],
    FOOD: ['먹방', '레시피', '요리', '음식', 'food', 'cooking', 'mukbang'],
    FASHION: ['패션', '코디', 'OOTD', '옷', 'fashion', 'outfit'],
    ELECTRONICS: ['가젯', '전자기기', '테크', '리뷰', 'tech', 'gadget', 'unboxing'],
    LIFESTYLE: ['라이프스타일', 'VLOG', '일상', '인테리어', 'lifestyle'],
    HEALTH: ['운동', '헬스', '다이어트', '피트니스', 'fitness', 'workout'],
    KIDS: ['육아', '키즈', '아기', '장난감', 'kids', 'toys'],
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
