/**
 * Instagram Public API Collector
 * API 키 필요 없음, 무료, Instagram 공개 프로필에서 릴스 수집
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

const IG_APP_ID = '936619743392459';

// 해외 아이디어템 / 상품 큐레이션 인스타 계정 (TikTokMadeMeBuyIt 장르)
// "단일 상품 시연 → 저장/공유 폭발" 콘텐츠를 올리는 페이지 위주
const GLOBAL_PRODUCT_ACCOUNTS = [
  // 아이디어템 / 발명품 큐레이션
  'awesome_inventions',
  'gadgetflow',
  'thegadgetflow',
  'dudeiwantthat',
  'awesomeshityoucanbuy',
  // 아마존 / 온라인 쇼핑 큐레이션
  'amazonfinds',
  'amazonfinder',
  'amazonmusthaves',
  'tiktokmademebuyit',
  // 가젯 / 라이프해킹
  'thegadgetzone',
  'gadgetsandgizmos',
  'cleverideas',
  'lifehacks',
  'satisfying.products',
  // 홈 / 키친 가젯
  'kitchengadgets',
  'homegadgets',
  // 트렌드 / 바이럴
  'viralproducts',
  'viralthings',
];

async function fetchUserReels(username: string): Promise<InstagramReel[]> {
  try {
    // Instagram now enforces Sec-Fetch-* policy on its private web API.
    // We mimic a browser fetch from the user's own profile page —
    // tested 2026-04, returns 200 with reels payload.
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-IG-App-ID': IG_APP_ID,
          'X-IG-WWW-Claim': '0',
          'X-ASBD-ID': '129477',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Referer': `https://www.instagram.com/${username}/`,
        },
      }
    );

    if (!res.ok) {
      console.error(`IG @${username}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const user = data?.data?.user;
    if (!user) return [];

    const fullName = user.full_name || username;
    const reels = user.edge_felix_video_timeline?.edges || [];

    return reels.map((edge: any) => {
      const node = edge.node || {};
      const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
      const shortcode = node.shortcode || '';

      return {
        id: node.id || shortcode,
        title: caption.split('\n')[0].substring(0, 200) || '무제',
        description: caption.substring(0, 500),
        thumbnailUrl: node.thumbnail_src || node.display_url || '',
        videoUrl: `https://www.instagram.com/reel/${shortcode}/`,
        authorName: fullName,
        authorId: username,
        viewCount: node.video_view_count || 0,
        likeCount: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
        commentCount: node.edge_media_to_comment?.count || 0,
        shareCount: 0,
      };
    });
  } catch (error) {
    console.error(`Instagram public API error for @${username}:`, error);
    return [];
  }
}

/**
 * 해외 product-curation 계정들의 릴스를 일괄 수집
 */
export async function collectKoreanReelsPublic(
  accounts?: string[],
): Promise<{ reels: InstagramReel[]; errors: string[] }> {
  const targetAccounts = accounts || GLOBAL_PRODUCT_ACCOUNTS;
  const allReels: InstagramReel[] = [];
  const errors: string[] = [];

  for (const username of targetAccounts) {
    try {
      const reels = await fetchUserReels(username);
      allReels.push(...reels);
      console.log(`  @${username}: ${reels.length}개 릴스`);
    } catch (err) {
      errors.push(`@${username}: ${String(err)}`);
    }
    // rate limit 방지
    await new Promise(r => setTimeout(r, 2000));
  }

  return { reels: allReels, errors };
}