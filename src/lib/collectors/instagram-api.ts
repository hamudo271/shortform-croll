/**
 * Instagram Reels Collector — RapidAPI "Instagram Scraper 2025"
 * (instagram-scraper-20251.p.rapidapi.com)
 *
 * 틱톡과 동일한 수집 철학:
 *  - 고정 계정이 아니라 buy-intent 해시태그로 "전체 검색"(hashtagposts?keyword=)
 *  - 다양한 셀러의 바이럴 단일상품 릴스를 발굴
 *  - 게이팅(조회수·최신성·영어권·셀러링크·얼굴제외)은 collect 라우트가 담당
 *    → 틱톡 STEP 3 루프와 동일 구조
 */

export interface InstagramReel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  authorId: string; // = username (getOrFetchCreator 키 + userinfo 조회용)
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  takenAt?: number; // Unix seconds
}

// getOrFetchCreator / isQualifiedSeller 에 그대로 투입 (instagram-public.ts 와 동일)
export interface InstagramCreatorInfo {
  username: string;
  authorName: string;
  bioUrl: string | null;
  signature: string;
  followerCount: number | null;
  videoCount: number | null;
}

const RAPIDAPI_HOST = 'instagram-scraper-20251.p.rapidapi.com';

// 틱톡과 동일한 buy-intent 해시태그 풀 (각 1콜, ~30건 반환)
export const IG_BUYINTENT_HASHTAGS = [
  'tiktokmademebuyit',
  'amazonfinds',
  'amazonmusthaves',
  'tiktokshopfinds',
  'founditonamazon',
  'amazonfind',
  'kitchengadgets',
  'homegadgets',
  'usefulgadgets',
  'coolgadgets',
  'gadgetsofinstagram',
  'musthaveproducts',
];

function rapidHeaders(apiKey: string) {
  return { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': apiKey };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapItemToReel(item: any): InstagramReel | null {
  if (!item) return null;
  // 영상(릴스)만 — media_type 2 = video
  const isVideo = item.is_video || item.media_type === 2 || !!item.video_url || !!item.video_versions;
  if (!isVideo) return null;

  const caption = (item.caption?.text || '').toString();
  const code = item.code || '';
  if (!code) return null;
  const author = item.user || item.caption?.user || {};
  const username = author.username || '';
  if (!username) return null;

  const thumb =
    item.thumbnail_url ||
    item.image_versions2?.candidates?.[0]?.url ||
    '';
  const views = item.play_count ?? item.ig_play_count ?? item.view_count ?? 0;

  return {
    id: String(item.id || code),
    title: caption.split('\n')[0].substring(0, 200) || '무제',
    description: caption.substring(0, 500),
    thumbnailUrl: thumb,
    videoUrl: `https://www.instagram.com/reel/${code}/`,
    authorName: author.full_name || username,
    authorId: username,
    viewCount: views || 0,
    likeCount: item.like_count || 0,
    commentCount: item.comment_count || 0,
    shareCount: item.reshare_count || item.share_count || 0,
    takenAt: typeof item.taken_at === 'number' ? item.taken_at : undefined,
  };
}

/** 해시태그 1건 검색 → 릴스 목록 (틱톡 searchTikTokVideos 대응). */
export async function searchHashtagReels(
  keyword: string,
  apiKey: string,
): Promise<InstagramReel[]> {
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/hashtagposts?keyword=${encodeURIComponent(keyword)}`,
      { headers: rapidHeaders(apiKey) },
    );
    if (!res.ok) {
      console.error(`IG hashtag "${keyword}": HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items = data?.data?.items || data?.items || [];
    return items.map(mapItemToReel).filter((r: InstagramReel | null): r is InstagramReel => r !== null);
  } catch (err) {
    console.error(`IG hashtag "${keyword}" error:`, err);
    return [];
  }
}

/** 계정 프로필 — bio/external_url (의뢰인 ③ 커머스링크 게이트 소스). */
export async function fetchUserInfo(
  username: string,
  apiKey: string,
): Promise<InstagramCreatorInfo | null> {
  try {
    const res = await fetch(
      `https://${RAPIDAPI_HOST}/userinfo?username_or_id=${encodeURIComponent(username)}`,
      { headers: rapidHeaders(apiKey) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const u = json?.data || json;
    if (!u) return null;

    let bioUrl: string | null = u.external_url || null;
    if (!bioUrl && Array.isArray(u.bio_links) && u.bio_links.length > 0) {
      const first = u.bio_links.find((l: any) => l?.url || l?.lynx_url);
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
 * buy-intent 해시태그들을 순회 검색 → 릴스 풀 (중복 media 제거).
 * 게이팅(조회수·셀러·얼굴 등)은 호출부(collect 라우트)에서 틱톡과 동일하게 수행.
 */
export async function collectReelsByHashtags(
  apiKey: string,
  hashtags: string[] = IG_BUYINTENT_HASHTAGS,
): Promise<{ reels: InstagramReel[]; errors: string[] }> {
  const seen = new Set<string>();
  const reels: InstagramReel[] = [];
  const errors: string[] = [];

  for (const tag of hashtags) {
    try {
      const found = await searchHashtagReels(tag, apiKey);
      for (const r of found) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        reels.push(r);
      }
    } catch (err) {
      errors.push(`#${tag}: ${String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 400)); // rate limit 여유
  }

  return { reels, errors };
}
