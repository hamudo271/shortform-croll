/**
 * tikwm 기반 TikTok 커버(썸네일) 리졸버.
 *
 * 만료되는 signed CDN URL 과 tikwm 무료 한도(1 req/sec)를 함께 처리:
 * - 모듈 레벨 인메모리 캐시(50분 TTL — CDN 서명 만료보다 짧게)
 * - 요청 직렬화(1.1s 간격) + "Free Api Limit" 응답 재시도
 * - 동일 videoUrl 동시요청 dedup
 *
 * 이미지 프록시(/api/img)와 레거시 /api/thumbnail/tiktok 가 공유한다.
 */

const TTL_MS = 50 * 60 * 1000;
const RATE_LIMIT_MS = 1100;

const cache = new Map<string, { coverUrl: string; expiresAt: number }>();
const inflight = new Map<string, Promise<string | null>>();
let lastCallAt = 0;

async function fetchCoverFromTikwm(videoUrl: string): Promise<string | null> {
  const now = Date.now();
  const wait = Math.max(0, lastCallAt + RATE_LIMIT_MS - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const cover: string | undefined =
        data?.data?.origin_cover || data?.data?.cover || data?.data?.ai_dynamic_cover;
      if (cover) return cover;
      if (typeof data?.msg === 'string' && data.msg.toLowerCase().includes('limit')) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
        lastCallAt = Date.now();
        continue;
      }
      return null;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

/** videoUrl(틱톡 영상 URL) → 신선한 커버 이미지 URL. 실패 시 null. */
export async function resolveTikTokCover(videoUrl: string): Promise<string | null> {
  const cached = cache.get(videoUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.coverUrl;

  const flying = inflight.get(videoUrl);
  if (flying) return flying;

  const promise = (async () => {
    const cover = await fetchCoverFromTikwm(videoUrl);
    if (cover) cache.set(videoUrl, { coverUrl: cover, expiresAt: Date.now() + TTL_MS });
    inflight.delete(videoUrl);
    return cover;
  })();
  inflight.set(videoUrl, promise);
  return promise;
}
