/**
 * TikTok Collector using tikwm.com unofficial API
 * No API key required, no Puppeteer needed
 */

export interface TikTokVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  authorId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

const TIKWM_API = 'https://www.tikwm.com/api';

/** origin_cover가 더 안정적 (만료가 늦거나 없음), 없으면 cover 사용 */
function getStableThumbnail(v: any): string {
  return v.origin_cover || v.cover || '';
}

/**
 * Search TikTok videos by keyword
 */
export async function searchTikTokVideos(
  keyword: string,
  options: { count?: number } = {}
): Promise<TikTokVideo[]> {
  const { count = 30 } = options;

  try {
    const res = await fetch(`${TIKWM_API}/feed/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        keywords: keyword,
        count: String(count),
        cursor: '0',
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const videos = data?.data?.videos || [];

    return videos
      .filter((v: any) => {
        // 한국어 제목/설명만
        const text = `${v.title || ''} ${v.region || ''}`;
        return /[가-힣]/.test(text) || v.region === 'KR';
      })
      .map((v: any) => ({
        id: String(v.video_id || v.id),
        title: v.title || '',
        description: v.title || '',
        thumbnailUrl: getStableThumbnail(v),
        videoUrl: `https://www.tiktok.com/@${v.author?.unique_id || 'user'}/video/${v.video_id || v.id}`,
        authorName: v.author?.nickname || v.author?.unique_id || '',
        authorId: v.author?.unique_id || '',
        viewCount: v.play_count || 0,
        likeCount: v.digg_count || 0,
        commentCount: v.comment_count || 0,
        shareCount: v.share_count || 0,
      }));
  } catch (error) {
    console.error(`TikTok search error for "${keyword}":`, error);
    return [];
  }
}

/**
 * Get TikTok trending/popular videos
 */
export async function getTikTokTrending(
  options: { count?: number } = {}
): Promise<TikTokVideo[]> {
  const { count = 30 } = options;

  try {
    const res = await fetch(`${TIKWM_API}/feed/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        region: 'KR',
        count: String(count),
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const videos = data?.data || [];

    return videos
      .filter((v: any) => /[가-힣]/.test(v.title || ''))
      .map((v: any) => ({
        id: String(v.video_id || v.id),
        title: v.title || '',
        description: v.title || '',
        thumbnailUrl: getStableThumbnail(v),
        videoUrl: `https://www.tiktok.com/@${v.author?.unique_id || 'user'}/video/${v.video_id || v.id}`,
        authorName: v.author?.nickname || v.author?.unique_id || '',
        authorId: v.author?.unique_id || '',
        viewCount: v.play_count || 0,
        likeCount: v.digg_count || 0,
        commentCount: v.comment_count || 0,
        shareCount: v.share_count || 0,
      }));
  } catch (error) {
    console.error('TikTok trending error:', error);
    return [];
  }
}
