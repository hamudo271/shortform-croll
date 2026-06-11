import { NextRequest, NextResponse } from 'next/server';
import { resolveTikTokCover } from '@/lib/tikwm';

/**
 * 외부 썸네일 바이트 프록시.
 *
 * TikTok/Instagram CDN 썸네일은 서명된 핫링크 차단 URL이라, 브라우저가 직접 로드하면
 * Referer 때문에 403 으로 깨진다. 서버가 Referer 없이 받아서 바이트로 되돌려주면 통과한다.
 *
 *   GET /api/img?u=<cdnUrl>&tt=<선택: 틱톡 영상 URL>
 *
 * - u 의 host 는 allowlist(틱톡/인스타 CDN)만 허용 → open-proxy/SSRF 방지
 * - u 로딩 실패(만료 등) + tt 가 있으면 tikwm 로 신선한 커버를 재해결해 재시도
 * - 성공 시 6시간 캐시
 */

export const maxDuration = 30;

const ALLOWED_HOST_SUFFIXES = [
  '.cdninstagram.com',
  '.fbcdn.net',
  '.tiktokcdn.com',
  '.tiktokcdn-us.com',
  '.tiktokcdn-eu.com',
  '.tiktokcdn-in.com',
  '.ibyteimg.com',
  '.muscdn.com',
  '.akamaized.net',
];

function isAllowed(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.host.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

async function fetchImage(url: string): Promise<Response | null> {
  try {
    // Referer 미전송(referrer 기본값) + 브라우저 UA 로 핫링크 차단 우회
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    return res;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u');
  const tt = req.nextUrl.searchParams.get('tt'); // 틱톡 영상 URL (만료 시 재해결용)

  if (!u || !isAllowed(u)) {
    return NextResponse.json({ error: 'Missing or disallowed url' }, { status: 400 });
  }

  // 1차: 저장된 CDN URL 그대로 시도
  let res = await fetchImage(u);

  // 2차: 실패 + 틱톡 영상 URL 있으면 신선한 커버로 재해결
  if (!res && tt && tt.includes('tiktok.com')) {
    const fresh = await resolveTikTokCover(tt);
    if (fresh && isAllowed(fresh)) res = await fetchImage(fresh);
  }

  if (!res) {
    return NextResponse.json({ error: 'Image unavailable' }, { status: 502 });
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buf.length),
      'Cache-Control': 'public, max-age=21600, stale-while-revalidate=86400',
    },
  });
}
