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

// 상품/구매 관련 키워드 - 이 중 하나라도 포함되어야 수집
const COMMERCE_KEYWORDS = [
  '추천', '꿀템', '리뷰', '언박싱', '하울', '신상', '가성비',
  '구매', '제품', '상품', '사용', '후기', '비교', '순위', '베스트',
  '할인', '세일', '특가', '핫딜', '쿠팡', '다이소', '올리브영',
  '알리', '직구', '맛집', '레시피', '인테리어', '소품', '용품',
  '화장품', '스킨케어', '메이크업', '향수', '뷰티', '패션',
  '코디', '데일리룩', '악세사리', '가방', '신발', '옷',
  '주방', '생활', '전자', '가젯', '폰케이스', '이어폰',
  '다이어트', '영양제', '건강', '운동', '홈트',
  '캠핑', '차박', '여행', '호텔',
  '육아', '아기', '반려', '강아지', '고양이',
  '편의점', '카페', '디저트', '빵', '음식',
  '브랜드', '명품', '프라다', '샤넬', '나이키', '아디다스',
  '팝마트', '레고', '피규어', '굿즈',
  'ad', '광고', '협찬', '링크',
];

// 제외 키워드 - 상업적 가치 없는 콘텐츠
const EXCLUDE_KEYWORDS = [
  '챌린지', 'challenge', '댄스', 'dance', '커플', '남친', '여친',
  '학교', '학생', '선생님', '군대', '입대',
  '게임', '롤', '배그', '오버워치', 'game',
  '팬캠', 'fancam', '직캠', '콘서트',
  '드라마', '영화', '예고편', '스포',
  '웃긴', '몰카', 'prank', '반응',
  'manhwa', 'manga', '만화', '웹툰', 'bl', 'fyp', 'foryoupage',
  'anime', '애니',
  // 예능/방송/연예인
  '오락실', '예능', '방송', '프로그램', '클립', '편집',
  '런닝맨', '나혼자산다', '놀면뭐하니', '지구오락실', '출장십오야',
  '아이돌', '데뷔', '컴백', '엠카', '뮤뱅', '음방',
  '연예인', '배우', '가수', '아이돌',
  'kpop', 'k-pop', 'idol',
  // 뉴스/정치/시사
  '뉴스', '정치', '대통령', '국회', '선거',
  // 스포츠
  '축구', '야구', '농구', '올림픽', '월드컵',
];

function isCommerceContent(title: string): boolean {
  const lower = title.toLowerCase();

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
        // 한국어 필수
        if (!/[가-힣]/.test(title)) return false;
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
        region: 'KR',
        count: String(count),
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const videos = data?.data || [];

    return videos
      .filter((v: any) => {
        const title = v.title || '';
        if (!/[가-힣]/.test(title)) return false;
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