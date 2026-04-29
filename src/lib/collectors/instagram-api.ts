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

// 해외 product-curation 인스타 계정 (TikTokMadeMeBuyIt 장르)
const KOREAN_REELS_ACCOUNTS = [
  'awesome_inventions',
  'gadgetflow',
  'thegadgetflow',
  'dudeiwantthat',
  'awesomeshityoucanbuy',
  'amazonfinds',
  'amazonfinder',
  'amazonmusthaves',
  'tiktokmademebuyit',
  'thegadgetzone',
  'gadgetsandgizmos',
  'cleverideas',
  'lifehacks',
  'satisfying.products',
  'kitchengadgets',
  'homegadgets',
  'viralproducts',
  'viralthings',
];

// 해외 상품 시연 / 큐레이션 키워드
const COMMERCE_KEYWORDS = [
  'tiktokmademebuyit', 'amazonfinds', 'amazonmusthaves', 'temufinds',
  'review', 'unboxing', 'haul', 'must have', 'must-have',
  'gadget', 'gadgets', 'invention', 'tool', 'product', 'find', 'finds',
  'kitchen', 'home', 'travel', 'office', 'desk', 'organization',
  'genius', 'clever', 'satisfying', 'lifehack', 'life hack', 'hack',
  'link in bio', 'shop', 'available', 'use code', 'discount', 'deal',
  'amazon', 'etsy', 'temu', 'shein', 'aliexpress',
  'ad', 'sponsored', 'gifted',
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
        // 한글 콘텐츠 제외 (해외 풀 전환), 상업 키워드 필수
        if (/[가-힣]/.test(text)) return false;
        return isCommerce(text);
      })
      .map((item: any) => {
        const caption = item?.caption?.text || '';
        const code = item?.code || '';
        const thumb = item?.thumbnail_url || item?.image_versions2?.candidates?.[0]?.url || item?.image_versions?.additional_items?.first_frame?.url || '';
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