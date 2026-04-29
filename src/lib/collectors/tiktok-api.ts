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
  /** Unix seconds — 원본 업로드 시각 (tikwm `create_time`) */
  createTime?: number;
}

const TIKWM_API = 'https://www.tikwm.com/api';

/** origin_cover가 더 안정적 (만료가 늦거나 없음), 없으면 cover 사용 */
function getStableThumbnail(v: any): string {
  return v.origin_cover || v.cover || '';
}

// STRONG commerce 신호 — 1개라도 매치되면 통과 (단순 단어 매칭으로 약한 신호 제거)
export const STRONG_COMMERCE = [
  // 메가 해시태그
  'tiktokmademebuyit', 'tiktok made me buy', 'tiktokmademebuy',
  'amazonfinds', 'amazon finds', 'amazonmusthaves', 'amazon must haves',
  'amazonhaul', 'amazon haul', 'amazon favorite', 'amazonfavorite',
  'temufinds', 'temu finds', 'sheinfinds', 'shein finds',
  'aliexpressfinds', 'aliexpress finds', 'etsyfinds', 'etsy finds',
  // 명시적 판매 시그널
  'link in bio', 'link bio', 'use code', 'discount code', 'promo code',
  'on amazon', 'on etsy', 'on temu', 'on shein',
  'available now', 'available on', 'shop now', 'get yours',
  'free shipping', 'order now', 'limited time',
  // 큐레이션 표현
  'must have', 'must-have', 'must buy', 'must-buy',
  'i bought this', 'bought this', 'just bought',
  // 광고 명시
  '#ad', 'sponsored by', 'gifted by', 'paid partnership',
];

// 제외 키워드 - 일상 / 유머 / 실험 / 논상업
export const EXCLUDE_KEYWORDS = [
  // 댄스 / 챌린지 / 팬캠
  'dance', 'dancing', 'choreography', 'challenge',
  'fancam', 'concert', 'tour vlog',
  // 일상 / vlog
  'day in my life', 'day in the life', 'vlog', 'vlogs', 'morning routine',
  'night routine', 'get ready with me', 'grwm', 'come with me',
  'pov', 'storytime', 'story time', 'relatable', 'mood',
  // 코미디 / 장난
  'prank', 'pranks', 'reaction', 'reacting', 'comedy', 'skit',
  'funny', 'joke', 'meme', 'cringe', 'parody', 'roast',
  // 실험 / 사이언스
  'experiment', 'experiments', 'experimenting',
  'science experiment', 'science fair',
  'what happens', 'what happens if', 'what if you',
  // 챌린지/지속성 영상
  'for 30 days', 'for a month', 'for a year', 'for a week',
  'i tried', 'tried for', 'days of',
  // 마술 / 환상
  'magic trick', 'magic tricks', 'illusion', 'illusions',
  'sleight of hand',
  // 실패
  'fail', 'fails', 'fail compilation', 'funny fails',
  // 호기심 / 잡지식
  'first time trying', 'reacting to', 'reaction video',
  'random fact',
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
  // ASMR / mukbang (단독)
  'mukbang', 'asmr eating',
  // 학교
  'school day', 'classroom', 'teacher', 'high school',
];

function isCommerceContent(title: string): boolean {
  const lower = title.toLowerCase();

  // 한글이 들어가면 한국 콘텐츠 → 해외 풀 전환에 따라 제외
  if (/[가-힣]/.test(title)) return false;

  // 제외 키워드가 있으면 바로 탈락
  if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return false;

  // STRONG commerce 신호가 1개라도 있어야 통과
  return STRONG_COMMERCE.some(kw => lower.includes(kw));
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
        createTime: typeof v.create_time === 'number' ? v.create_time : undefined,
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
        createTime: typeof v.create_time === 'number' ? v.create_time : undefined,
      }));
  } catch (error) {
    console.error('TikTok trending error:', error);
    return [];
  }
}