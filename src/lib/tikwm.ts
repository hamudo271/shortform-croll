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

/**
 * tikwm 무료 한도(1 req/sec) 공용 게이트.
 *
 * **tikwm.com 으로 나가는 모든 호출이 이걸 통과해야 한다.** 썸네일 리졸버와
 * 수집기(collectors/tiktok-api.ts)가 각자 쏘면 서로를 한도로 밀어내는데,
 * 한도에 걸린 응답은 에러가 아니라 `{code:-1, msg:"Free Api Limit"}` 라
 * 조용히 빈 결과로 처리된다 — 실제로 댓글 수집이 통째로 0건이 되어
 * 수요 점수(35점)가 측정 불가 상태로 빠져 있었다.
 */
export async function tikwmThrottle(): Promise<void> {
  const wait = Math.max(0, lastCallAt + RATE_LIMIT_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

/** 응답 본문이 "한도 초과"를 뜻하는지 — tikwm 은 이걸 200 으로 준다. */
export function isTikwmRateLimited(data: unknown): boolean {
  const msg = (data as { msg?: unknown })?.msg;
  return typeof msg === 'string' && msg.toLowerCase().includes('limit');
}

/**
 * tikwm JSON 호출 — 레이트리밋 대기 + "Free Api Limit" 재시도를 공통 처리.
 * 재시도까지 실패하면 null (호출부가 "결과 없음"과 구분할 수 있게).
 */
export async function tikwmJson<T = unknown>(
  path: string,
  init?: RequestInit,
  attempts = 3,
): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    await tikwmThrottle();
    try {
      const res = await fetch(`https://www.tikwm.com/api${path}`, {
        ...init,
        headers: { 'User-Agent': 'Mozilla/5.0', ...(init?.headers || {}) },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (isTikwmRateLimited(data)) continue; // throttle 이 다음 루프에서 간격을 벌린다
      return data as T;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

async function fetchCoverFromTikwm(videoUrl: string): Promise<string | null> {
  await tikwmThrottle();

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
