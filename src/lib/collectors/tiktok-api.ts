/**
 * TikTok Collector using tikwm.com unofficial API
 * No API key required, no Puppeteer needed
 * 상품/구매 관련 콘텐츠만 수집
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

// 해외 아이디어템 / 상품 시연 키워드 — 하나라도 포함되어야 수집
const COMMERCE_KEYWORDS = [
  // 메가 해시태그 (단어 매칭)
  'tiktokmademebuyit', 'tiktokmademebuy', 'amazonfinds', 'amazonmusthaves',
  'amazonhaul', 'amazonfavorite', 'temufinds', 'aliexpressfinds', 'sheinfinds',
  // 상품 시연 / 리뷰
  'review', 'unboxing', 'haul', 'bought', 'tried', 'tested',
  'try it', 'must have', 'must-have', 'must buy',
  // 가젯 / 발명품
  'gadget', 'gadgets', 'invention', 'inventions', 'tool', 'tools',
  'product', 'products', 'item', 'items', 'find', 'finds',
  // 카테고리
  'kitchen', 'home', 'office', 'travel', 'car', 'pet',
  'skincare', 'makeup', 'beauty', 'fashion', 'outfit',
  'tech', 'phone', 'desk', 'organization',
  // 판매 시그널
  'link in bio', 'shop', 'available', 'get yours', 'use code',
  'on amazon', 'on etsy', 'on temu', 'discount', 'deal', 'sale',
  'buy', 'order', 'free shipping', 'limited',
  // 감성 / 시연
  'satisfying', 'oddly satisfying', 'genius', 'clever', 'smart',
  'lifehack', 'life hack', 'hack', 'hacks', 'before and after',
  // 광고 표시
  'ad', '#ad', 'sponsored', 'gifted', 'pr',
];

// 제외 키워드 - 일상/유머/논상업 콘텐츠
const EXCLUDE_KEYWORDS = [
  // 댄스 / 챌린지 / 팬캠
  'dance', 'dancing', 'choreography', 'challenge',
  'fancam', 'concert', 'tour vlog',
  // 일상 / vlog
  'day in my life', 'day in the life', 'vlog', 'vlogs', 'morning routine',
  'night routine', 'get ready with me', 'grwm', 'come with me',
  'pov', 'storytime', 'story time', 'relatable', 'mood',
  // 코미디 / 장난
  'prank', 'pranks', 'reaction', 'reacting', 'comedy', 'skit',
  'funny', 'joke', 'meme', 'cringe',
  // 게임
  'gameplay', 'gaming', 'minecraft', 'fortnite', 'roblox', 'valorant',
  // 음악 / K-pop / J-pop
  'kpop', 'k-pop', 'jpop', 'j-pop', 'idol', 'mv', 'lyrics',
  'cover song', 'singing',
  // 애니메이션 / 만화
  'anime', 'manga', 'manhwa', 'webtoon', 'cosplay',
  // 뉴스 / 정치
  'news', 'politics', 'election', 'biden', 'trump',
  // 스포츠
  'football', 'basketball', 'soccer', 'nba', 'nfl', 'fifa',
  // ASMR / mukbang (단독, 비상업)
  'mukbang', 'asmr eating',
  // 학교 / 군대
  'school day', 'classroom', 'teacher', 'high school',
  // 한국어 콘텐츠 전부 제외 (해외 풀 전환)
  // 한글이 보이면 한국 콘텐츠로 간주
];

function isCommerceContent(title: string): boolean {
  const lower = title.toLowerCase();

  // 한글이 들어가면 한국 콘텐츠 → 해외 풀 전환에 따라 제외
  if (/[가-힣]/.test(title)) return false;

  // 제외 키워드가 있으면 바로 탈락
  if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return false;

  // 상업 키워드가 하나라도 있으면 통과
  return COMMERCE_KEYWORDS.some(kw => lower.includes(kw));
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
        const title = v.title || '';
        // 영어 텍스트 필수 (해외 아이디어템 풀)
        if (!/[a-zA-Z]{3,}/.test(title)) return false;
        // 상업적 콘텐츠만
        return isCommerceContent(title);
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
 * Get TikTok trending/popular videos - 트렌딩에서도 상업 콘텐츠만
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
        region: 'US',
        count: String(count),
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const videos = data?.data || [];

    return videos
      .filter((v: any) => {
        const title = v.title || '';
        if (!/[a-zA-Z]{3,}/.test(title)) return false;
        return isCommerceContent(title);
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
    console.error('TikTok trending error:', error);
    return [];
  }
}