import { NextRequest, NextResponse } from 'next/server';

/**
 * TikTok 썸네일 프록시.
 *
 * 만료되는 CDN signed URL 문제와 tikwm의 1 req/sec rate limit을 동시에 해결:
 * - 모듈 레벨 인메모리 캐시 (50분 TTL — CDN 서명 만료보다 짧게)
 * - 요청 직렬화 (1.1s 간격) + Free Api Limit 응답 시 재시도 2회
 * - 같은 videoUrl에 대한 동시 요청은 한 번만 fetch하고 결과 공유 (in-flight dedup)
 *
 * 결과: 페이지에 카드 26개 있어도 같은 URL은 1번만 tikwm을 거치고,
 * 다른 URL들은 1.1초 간격으로 순차 처리. 두 번째 방문부터는 캐시 히트.
 */

export const maxDuration = 60;

const TTL_MS = 50 * 60 * 1000; // 50분 — CDN x-expires가 보통 1시간이라 그 안쪽
const RATE_LIMIT_MS = 1100; // tikwm 무료 한도 = 1 req/sec, 여유 100ms

const cache = new Map<string, { coverUrl: string; expiresAt: number }>();
const inflight = new Map<string, Promise<string | null>>();
let lastCallAt = 0;

async function fetchCoverFromTikwm(videoUrl: string): Promise<string | null> {
  // Rate limit: 마지막 호출과 1.1s 간격 보장
  const now = Date.now();
  const wait = Math.max(0, lastCallAt + RATE_LIMIT_MS - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const cover: string | undefined =
        data?.data?.origin_cover || data?.data?.cover || data?.data?.ai_dynamic_cover;
      if (cover) return cover;
      // rate-limit 응답은 msg에 "Free Api Limit" — 한 번 더 기다렸다 재시도
      if (typeof data?.msg === 'string' && data.msg.toLowerCase().includes('limit')) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
        lastCallAt = Date.now();
        continue;
      }
      return null;
    } catch {
      // 네트워크 에러는 짧게 대기 후 재시도
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

async function getCover(videoUrl: string): Promise<string | null> {
  const cached = cache.get(videoUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.coverUrl;

  const flying = inflight.get(videoUrl);
  if (flying) return flying;

  const promise = (async () => {
    const cover = await fetchCoverFromTikwm(videoUrl);
    if (cover) {
      cache.set(videoUrl, { coverUrl: cover, expiresAt: Date.now() + TTL_MS });
    }
    inflight.delete(videoUrl);
    return cover;
  })();
  inflight.set(videoUrl, promise);
  return promise;
}

export async function GET(req: NextRequest) {
  const videoUrl = req.nextUrl.searchParams.get('url');
  if (!videoUrl || !videoUrl.includes('tiktok.com')) {
    return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
  }

  try {
    const coverUrl = await getCover(videoUrl);
    if (!coverUrl) {
      return NextResponse.json({ error: 'Cover not available' }, { status: 502 });
    }
    return NextResponse.redirect(coverUrl, {
      status: 302,
      headers: { 'Cache-Control': 'public, max-age=3000' }, // 50분 — 캐시 TTL과 맞춤
    });
  } catch (err) {
    console.error('TikTok thumbnail proxy error:', err);
    return NextResponse.json({ error: 'Failed', details: String(err) }, { status: 500 });
  }
}
