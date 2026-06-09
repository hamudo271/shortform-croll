/**
 * Instagram Reels Collector — RapidAPI "Instagram Scraper 2025"
 * (instagram-scraper-20251.p.rapidapi.com)
 *
 * 공개 web_profile_info 방식(instagram-public.ts)은 Railway 데이터센터 IP가
 * IG 에 차단돼 prod 에서 무용지물 → RapidAPI 가 자기 IP 로 대신 긁어준다.
 *
 * 반환 형태는 instagram-public.ts 의 collectKoreanReelsPublic() 과 동일
 * (`{ reels, errors, creators }`) 으로 맞춰 collect 라우트에서 drop-in 교체 가능.
 *
 * 계정당 2콜:
 *   - /userinfo  → 크리에이터 bio/external_url (③ 프로필 커머스 링크 필수 검증용)
 *   - /userreels → 릴스 목록
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
  /** Unix seconds — 원본 업로드 시각 */
  takenAt?: number;
}

// instagram-public.ts 와 동일 형태 — getOrFetchCreator / isQualifiedSeller 에 그대로 투입
export interface InstagramCreatorInfo {
  username: string;
  authorName: string;
  bioUrl: string | null;
  signature: string;
  followerCount: number | null;
  videoCount: number | null;
}

const RAPIDAPI_HOST = 'instagram-scraper-20251.p.rapidapi.com';

// 해외 product-curation 인스타 계정.
// ⚠️ 큐레이션 필요: 아래는 시드 목록이며, 실측(2026-06) 결과 다수가 죽었거나
// 최근 릴스를 안 올린다. 의뢰인의 타깃 니치(buy-intent 단일상품 셀러)에 맞는
// 계정으로 교체/추가하는 것이 핵심. 0건 반환 계정은 API 콜만 낭비하므로 정리함.
//   살아있음 확인: gadgetflow(최근), amazonfinds(2024 구), lifehacks(최근), tiktokmademebuyit
export const IG_PRODUCT_ACCOUNTS = [
  'gadgetflow',
  'amazonfinds',
  'amazonmusthaves',
  'awesome_inventions',
  'dudeiwantthat',
  'awesomeshityoucanbuy',
  'tiktokmademebuyit',
];

function rapidHeaders(apiKey: string) {
  return {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': apiKey,
  };
}

/**
 * 계정 프로필 정보 — bio/external_url (커머스 링크), biography, 미디어 수.
 * 의뢰인 ③ "프로필에 구매 가능한 링크 필수" 검증의 핵심 소스.
 */
async function fetchUserInfo(
  username: string,
  apiKey: string,
): Promise<InstagramCreatorInfo | null> {
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/userinfo?username_or_id=${encodeURIComponent(username)}`,
      { headers: rapidHeaders(apiKey) },
    );
    if (!res.ok) {
      console.error(`IG userinfo @${username}: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const u = json?.data || json;
    if (!u) return null;

    // 커머스 링크: external_url 우선, 없으면 bio_links 의 첫 외부 링크
    let bioUrl: string | null = u.external_url || null;
    if (!bioUrl && Array.isArray(u.bio_links) && u.bio_links.length > 0) {
      const first = u.bio_links.find((l: { url?: string; lynx_url?: string }) => l?.url || l?.lynx_url);
      bioUrl = first?.url || first?.lynx_url || null;
    }

    return {
      username,
      authorName: u.full_name || username,
      bioUrl,
      signature: (u.biography || '').toString(),
      followerCount: typeof u.follower_count === 'number' ? u.follower_count : null,
      videoCount: typeof u.media_count === 'number' ? u.media_count : null,
    };
  } catch (err) {
    console.error(`IG userinfo error @${username}:`, err);
    return null;
  }
}

/**
 * 계정 릴스 목록 — 한글 제외 + 캡션 커머스 신호 필수.
 */
async function fetchUserReels(
  username: string,
  apiKey: string,
): Promise<InstagramReel[]> {
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/userreels?username_or_id=${encodeURIComponent(username)}`,
      { headers: rapidHeaders(apiKey) },
    );
    if (!res.ok) {
      console.error(`IG userreels @${username}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data?.data?.items || [];

    return items
      .filter((item: { caption?: { text?: string } }) => {
        const text = item?.caption?.text || '';
        if (/[가-힣]/.test(text)) return false; // 한글 콘텐츠 제외
        // 주의: IG 는 구매 링크가 캡션이 아니라 프로필(bio)에 있다.
        // 의뢰인 ③(프로필 구매링크 필수)는 크리에이터 게이트(hasSalesLink)가
        // 강제하므로, 캡션 커머스 키워드를 '하드 필터'로 쓰면 정상 제품 릴스가
        // 대량 누락된다(실측: gadgetflow 최근 릴스 commerce=0). → 차단하지 않는다.
        return true;
      })
      .map((item: Record<string, unknown>) => {
        const caption = ((item.caption as { text?: string })?.text || '').toString();
        const code = (item.code as string) || '';
        const thumb =
          (item.thumbnail_url as string) ||
          ((item.image_versions2 as { candidates?: { url?: string }[] })?.candidates?.[0]?.url) ||
          '';
        const author = ((item.caption as { user?: Record<string, unknown> })?.user ||
          (item.user as Record<string, unknown>) ||
          {}) as Record<string, unknown>;
        const views =
          (item.play_count as number) ??
          (item.ig_play_count as number) ??
          (item.view_count as number) ??
          0;

        return {
          id: String((item.id as string) || code),
          title: caption.split('\n')[0].substring(0, 200) || '무제',
          description: caption.substring(0, 500),
          thumbnailUrl: thumb,
          videoUrl: `https://www.instagram.com/reel/${code}/`,
          authorName: (author.full_name as string) || (author.username as string) || username,
          authorId: username,
          viewCount: views || 0,
          likeCount: (item.like_count as number) || 0,
          commentCount: (item.comment_count as number) || 0,
          shareCount: (item.reshare_count as number) || (item.share_count as number) || 0,
          takenAt: typeof item.taken_at === 'number' ? (item.taken_at as number) : undefined,
        } as InstagramReel;
      });
  } catch (err) {
    console.error(`IG userreels error @${username}:`, err);
    return [];
  }
}

/**
 * 제품 큐레이션 계정들의 릴스 + 크리에이터 정보를 일괄 수집.
 * 반환 형태는 instagram-public.collectKoreanReelsPublic() 과 동일.
 */
export async function collectProductReelsViaRapidApi(
  apiKey: string,
  accounts: string[] = IG_PRODUCT_ACCOUNTS,
): Promise<{
  reels: InstagramReel[];
  errors: string[];
  creators: Map<string, InstagramCreatorInfo>;
}> {
  const allReels: InstagramReel[] = [];
  const errors: string[] = [];
  const creators = new Map<string, InstagramCreatorInfo>();

  for (const username of accounts) {
    try {
      // 1) 프로필 (커머스 링크 검증용) — 실패해도 릴스는 시도
      const creator = await fetchUserInfo(username, apiKey);
      if (creator) creators.set(username, creator);
      await new Promise((r) => setTimeout(r, 400));

      // 2) 릴스
      const reels = await fetchUserReels(username, apiKey);
      allReels.push(...reels);
    } catch (err) {
      errors.push(`@${username}: ${String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 400)); // rate limit 여유 (Pro: 30/min)
  }

  return { reels: allReels, errors, creators };
}
