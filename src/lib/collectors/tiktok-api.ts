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

/** tikwm 검색/피드 응답의 원본 비디오 항목(필요 필드만, 전부 optional). */
interface RawTikwmVideo {
  video_id?: string | number;
  id?: string | number;
  title?: string;
  origin_cover?: string;
  cover?: string;
  play_count?: number;
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
  create_time?: number;
  author?: { unique_id?: string; nickname?: string };
}

/**
 * TikTok 작성자 프로필 정보. bioLink.link / signature / 팔로워 수 등.
 * tikwm /api/user/info?unique_id=X
 */
export async function fetchTikTokUser(uniqueId: string): Promise<{
  bioUrl: string | null;
  signature: string;
  followerCount: number | null;
  videoCount: number | null;
  authorName: string;
} | null> {
  try {
    const res = await fetch(`${TIKWM_API}/user/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ unique_id: uniqueId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.data?.user;
    if (!user) return null;
    const stats = data?.data?.stats || {};
    return {
      bioUrl: user?.bioLink?.link || null,
      signature: user?.signature || '',
      followerCount: typeof stats.followerCount === 'number' ? stats.followerCount : null,
      videoCount: typeof stats.videoCount === 'number' ? stats.videoCount : null,
      authorName: user?.nickname || user?.uniqueId || uniqueId,
    };
  } catch (err) {
    console.error(`TikTok user fetch error (@${uniqueId}):`, err);
    return null;
  }
}

/**
 * 영상의 상위 N개 댓글 텍스트만 추출.
 * tikwm /api/comment/list (POST, form-encoded `url` param)
 */
export async function fetchTikTokComments(videoUrl: string, count = 20): Promise<string[]> {
  try {
    const res = await fetch(`${TIKWM_API}/comment/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: videoUrl, count: String(count), cursor: '0' }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const comments = data?.data?.comments || [];
    return comments.map((c: { text?: string }) => c?.text || '').filter(Boolean);
  } catch (err) {
    console.error(`TikTok comments error (${videoUrl}):`, err);
    return [];
  }
}

/** origin_cover가 더 안정적 (만료가 늦거나 없음), 없으면 cover 사용 */
function getStableThumbnail(v: RawTikwmVideo): string {
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

// Talking-head / 리스티클 패턴 — 사람이 카메라 앞에서 "Here are 10 things…" 식으로
// 말하는 영상. 사용자가 원하는 톤 (단일 제품 시연, 얼굴 안 나옴) 과 정반대라 거름.
const TALKING_HEAD_RE = new RegExp(
  [
    // First-person opener with number: "here are 10 ...", "here's the 5 ..."
    '\\bhere\\s+(?:are|is|\'?s)\\s+(?:the\\s+|my\\s+)?\\d',
    // "These are the 10 ..."
    '\\bthese\\s+are\\s+(?:the\\s+|my\\s+)\\d',
    // 직접 호명 + 발화 동사
    '\\byou\\s+all\\s+(?:have\\s+)?asked',
    '\\b(?:i|i\'ll)\\s+shall\\b',
    '\\blet\\s+me\\s+show\\s+you',
    '\\bi\'?m\\s+sharing',
    // "my favorite/favourite" — 인플루언서 큐레이션 멘트
    '\\bmy\\s+(?:amazon\\s+)?favou?rites?\\b',
    '\\bmy\\s+(?:weekly|monthly)\\s+(?:haul|picks?|favou?rites?)\\b',
    // 숫자 + 리스티클 단어
    '\\b\\d{1,2}\\s+amazon\\s+(?:finds?|must.?haves?|essentials?|items?|tech|things|gadgets?)\\b',
    '\\b\\d{1,2}\\s+winning\\s+\\w+\\s+products?\\b',
    '\\b\\d{1,2}\\s+things\\s+(?:you|i|that|every|to)\\b',
    '\\b(?:top|best)\\s+\\d{1,2}\\s+amazon\\b',
    '\\bmust.?haves?\\s+you\\s+(?:didn\'?t|don\'?t|need)\\b',
    // 다제품 listicle / 베스트픽 — "어떤 상품 파는지 명확하지 않은" 영상 (의뢰인 피드백)
    '\\bmost\\s+(?:purchased|loved|wanted|viral|popular)\\b',
    '\\bbest\\s+sellers?\\s+of\\s+20\\d{2}\\b',
    '\\b(?:amazon|tiktok|temu|shein)\\s+finds?\\s+(?:that\\s+are|of\\s+20\\d{2}|to\\s+(?:buy|get))\\b',
    '\\bfinds?\\s+blowing\\s+up\\b',
    '\\bwhich\\s+is\\s+your\\s+favou?rite\\b',
    '\\brestock(?:s|ing)?\\b',
    '\\b(?:fridge|pantry|kitchen)\\s+restock\\b',
    // "Most Viral X of 20YY" 류 베스트픽 — 단일 제품 시연 아님
    '\\bmost\\s+viral\\s+(?:gadget|product|find|item)\\s+of\\b',
    // "X favorite/picks of YEAR"
    '\\bfavou?rites?\\s+of\\s+20\\d{2}\\b',
    // 단독 "haul" — 정의상 다제품 모음 (단일상품 시연 아님)
    '\\bhauls?\\b',
  ].join('|'),
  'i',
);

/** 다제품 리스티클/큐레이션 멘트 여부 (단일상품 시연이 아님). 타 플랫폼에서도 재사용. */
export function isListicleTitle(text: string): boolean {
  return TALKING_HEAD_RE.test(text || '');
}

function isCommerceContent(title: string): boolean {
  const lower = title.toLowerCase();

  // 한글이 들어가면 한국 콘텐츠 → 해외 풀 전환에 따라 제외
  if (/[가-힣]/.test(title)) return false;

  // 제외 키워드가 있으면 바로 탈락
  if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return false;

  // talking-head / 리스티클 영상 거부 (사용자: "얼굴보다는 제품만 주구장창")
  if (TALKING_HEAD_RE.test(title)) return false;

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
      .filter((v: RawTikwmVideo) => {
        const title = v.title || '';
        // 영어 텍스트 필수 (해외 아이디어템 풀)
        if (!/[a-zA-Z]{3,}/.test(title)) return false;
        // 상업적 콘텐츠만
        return isCommerceContent(title);
      })
      .map((v: RawTikwmVideo) => ({
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
      .filter((v: RawTikwmVideo) => {
        const title = v.title || '';
        if (!/[a-zA-Z]{3,}/.test(title)) return false;
        return isCommerceContent(title);
      })
      .map((v: RawTikwmVideo) => ({
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

