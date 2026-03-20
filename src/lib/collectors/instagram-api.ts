/**
 * Instagram Reels Collector using RapidAPI Instagram Scraper 2025
 * 한국 인기 계정의 릴스를 수집하여 상업적 트렌드 파악
 */

export interface InstagramReel {
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

const RAPIDAPI_HOST = 'instagram-scraper-20251.p.rapidapi.com';

// 한국 인기 상업/리뷰 인스타 계정 목록
const KOREAN_REELS_ACCOUNTS = [
  'oliveyoung_official',   // 올리브영
  'daiso_kr',              // 다이소
  'kurly.official',        // 마켓컬리
  'coupang.official',      // 쿠팡
  'musinsa_official',      // 무신사
  'casamia_official',      // 까사미아
  'ssg.official',          // SSG
  'lotteon_official',      // 롯데온
  'innisfreeofficial',     // 이니스프리
  'etloq_official',        // 에뛰드
  'stylenanda_korea',      // 스타일난다
  'abib.official',         // 아비브
  'romand_official',       // 롬앤
  'amuse_official',        // 어뮤즈
  'kirsh_official',        // 키르시
  'mardi_mercredi',        // 마르디메크르디
  'ottogi_official',       // 오뚜기
  'goshopping_official',   // GS SHOP
  'hmall_official',        // 현대홈쇼핑
  'cj.onstyle',           // CJ 온스타일
];

// 상업 키워드 필터
const COMMERCE_KEYWORDS = [
  '추천', '꿀템', '리뷰', '언박싱', '하울', '신상', '가성비',
  '구매', '제품', '상품', '후기', '비교', '순위', '베스트',
  '할인', '세일', '특가', '핫딜', '맛집', '레시피',
  '화장품', '스킨케어', '메이크업', '향수', '뷰티', '패션',
  '코디', '데일리룩', '용품', '소품', '인테리어',
  '다이어트', '영양제', '건강', '편의점', '카페', '디저트',
  '광고', '협찬', '링크', '출시', '한정', 'new', 'best',
];

function isCommerce(text: string): boolean {
  const lower = text.toLowerCase();
  return COMMERCE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * 특정 계정의 릴스 수집
 */
async function fetchUserReels(
  username: string,
  apiKey: string,
): Promise<InstagramReel[]> {
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/userreels?username_or_id=${username}`,
      {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': apiKey,
        },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const items = data?.data?.items || [];

    return items
      .filter((item: any) => {
        const text = item?.caption?.text || '';
        // 한국어 포함 또는 상업 키워드 포함
        return /[가-힣]/.test(text) || isCommerce(text);
      })
      .map((item: any) => {
        const caption = item?.caption?.text || '';
        const code = item?.code || '';
        const thumb = item?.image_versions2?.candidates?.[0]?.url || '';
        const author = item?.caption?.user || item?.user || {};

        return {
          id: String(item.pk || item.id || code),
          title: caption.split('\n')[0].substring(0, 200) || '무제',
          description: caption.substring(0, 500),
          thumbnailUrl: thumb,
          videoUrl: `https://www.instagram.com/reel/${code}/`,
          authorName: author?.full_name || author?.username || username,
          authorId: username,
          viewCount: item.play_count || item.view_count || 0,
          likeCount: item.like_count || 0,
          commentCount: item.comment_count || 0,
          shareCount: item.reshare_count || 0,
        };
      });
  } catch (error) {
    console.error(`Instagram reels error for @${username}:`, error);
    return [];
  }
}

/**
 * 한국 인기 계정들의 릴스를 일괄 수집
 */
export async function collectKoreanReels(
  apiKey: string,
  accounts?: string[],
): Promise<{ reels: InstagramReel[]; errors: string[] }> {
  const targetAccounts = accounts || KOREAN_REELS_ACCOUNTS;
  const allReels: InstagramReel[] = [];
  const errors: string[] = [];

  for (const username of targetAccounts) {
    try {
      const reels = await fetchUserReels(username, apiKey);
      allReels.push(...reels);
    } catch (err) {
      errors.push(`@${username}: ${String(err)}`);
    }
    // API rate limit 방지
    await new Promise(r => setTimeout(r, 500));
  }

  return { reels: allReels, errors };
}