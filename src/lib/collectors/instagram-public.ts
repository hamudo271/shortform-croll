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
  /** Unix seconds — 원본 업로드 시각 (IG `taken_at_timestamp`) */
  takenAt?: number;
}

const IG_APP_ID = '936619743392459';

// 해외 아이디어템 / 상품 큐레이션 인스타 계정
// IG 공개 web_profile_info API는 일부 계정만 reels timeline을 반환 —
// 직접 probe로 검증된 계정만 유지 (2026-04-29 기준).
// 추가 후보가 있으면 probe 후 추가하면 됨.
const GLOBAL_PRODUCT_ACCOUNTS = [
  'gadgetflow',     // 12 reels (검증됨)
  'amazonfinds',    // 6 reels (검증됨)
  'unboxtherapy',   // 10 reels (검증됨)
];

export interface InstagramCreatorInfo {
  username: string;
  authorName: string;
  bioUrl: string | null;
  signature: string;
  followerCount: number | null;
  videoCount: number | null;
}

const IG_HEADERS = (referer: string) => ({
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
  'Referer': referer,
});

async function fetchUserReels(username: string): Promise<{ reels: InstagramReel[]; creator: InstagramCreatorInfo | null }> {
  try {
    // Step 1: web_profile_info → user.id + bio/external_url + biography
    // (edge_felix_video_timeline은 폐지된 IGTV라 비어있거나 옛날 콘텐츠뿐)
    const profileRes = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      { headers: IG_HEADERS(`https://www.instagram.com/${username}/`) }
    );

    if (!profileRes.ok) {
      console.error(`IG @${username}: profile HTTP ${profileRes.status}`);
      return { reels: [], creator: null };
    }

    const profileData = await profileRes.json();
    const user = profileData?.data?.user;
    if (!user) return { reels: [], creator: null };

    const userId = user.id;
    const fullName = user.full_name || username;

    const creator: InstagramCreatorInfo = {
      username,
      authorName: fullName,
      bioUrl: user.external_url || null,
      signature: user.biography || '',
      followerCount: user.edge_followed_by?.count || null,
      // 게시물 총 개수 — IG는 reels와 사진을 분리하지 않으므로 전체 미디어 카운트
      videoCount: user.edge_owner_to_timeline_media?.count ?? null,
    };

    if (!userId) return { reels: [], creator };

    // Step 2: i.instagram.com modern feed → 최신 reels (clips)
    // 12개 default, count 늘려도 IG가 무시하기도 함
    const feedRes = await fetch(
      `https://i.instagram.com/api/v1/feed/user/${userId}/?count=24`,
      { headers: IG_HEADERS(`https://www.instagram.com/${username}/`) }
    );

    if (!feedRes.ok) {
      console.error(`IG @${username}: feed HTTP ${feedRes.status}`);
      return { reels: [], creator };
    }

    const feedData = await feedRes.json();
    const items: Array<Record<string, unknown>> = feedData?.items || [];

    // 릴스(클립)만 — product_type === 'clips' 또는 media_type === 2
    type FeedItem = {
      pk?: string | number;
      id?: string;
      code?: string;
      product_type?: string;
      media_type?: number;
      taken_at?: number;
      play_count?: number;
      view_count?: number;
      like_count?: number;
      comment_count?: number;
      caption?: { text?: string };
      image_versions2?: { candidates?: Array<{ url?: string }> };
      user?: { username?: string; full_name?: string };
    };

    const mappedReels = (items as FeedItem[])
      .filter((it) => it.product_type === 'clips' || it.media_type === 2)
      .map((it) => {
        const code = it.code || '';
        const caption = it.caption?.text || '';
        const thumb = it.image_versions2?.candidates?.[0]?.url || '';
        return {
          id: String(it.pk || it.id || code),
          title: caption.split('\n')[0].substring(0, 200) || '무제',
          description: caption.substring(0, 500),
          thumbnailUrl: thumb,
          videoUrl: `https://www.instagram.com/reel/${code}/`,
          authorName: it.user?.full_name || it.user?.username || fullName,
          authorId: username,
          viewCount: it.play_count || it.view_count || 0,
          likeCount: it.like_count || 0,
          commentCount: it.comment_count || 0,
          shareCount: 0,
          takenAt: typeof it.taken_at === 'number' ? it.taken_at : undefined,
        };
      });

    return { reels: mappedReels, creator };
  } catch (error) {
    console.error(`Instagram public API error for @${username}:`, error);
    return { reels: [], creator: null };
  }
}

/**
 * 해외 product-curation 계정들의 릴스를 일괄 수집.
 * 동시에 각 계정의 creator info(외부 링크 + bio)도 함께 반환 — 추가 API 호출 없음.
 */
export async function collectKoreanReelsPublic(
  accounts?: string[],
): Promise<{
  reels: InstagramReel[];
  errors: string[];
  creators: Map<string, InstagramCreatorInfo>;
}> {
  const targetAccounts = accounts || GLOBAL_PRODUCT_ACCOUNTS;
  const allReels: InstagramReel[] = [];
  const errors: string[] = [];
  const creators = new Map<string, InstagramCreatorInfo>();

  for (const username of targetAccounts) {
    try {
      const { reels, creator } = await fetchUserReels(username);
      allReels.push(...reels);
      if (creator) creators.set(username, creator);
      console.log(`  @${username}: ${reels.length}개 릴스 (bio=${creator?.bioUrl ? '✓' : '✗'})`);
    } catch (err) {
      errors.push(`@${username}: ${String(err)}`);
    }
    // rate limit 방지 — 2단계 호출(profile + feed) 하므로 더 보수적으로
    await new Promise(r => setTimeout(r, 4000));
  }

  return { reels: allReels, errors, creators };
}