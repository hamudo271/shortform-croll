import { NextRequest, NextResponse } from 'next/server';

/**
 * TikTok 썸네일 프록시 — 만료된 CDN signed URL 문제 해결.
 *
 * 문제: tikwm 응답으로 받은 cover URL은 `x-expires` + `x-signature` 쿼리가
 * 붙은 서명 URL이라 보통 1시간~며칠 안에 만료. DB에 저장한 URL을 그대로
 * 화면에 쓰면 며칠 뒤엔 전부 broken-image.
 *
 * 해결: GET /api/thumbnail/tiktok?url=TIKTOK_VIDEO_URL 가 들어오면
 * tikwm /api/?url=... 를 호출해서 fresh cover URL을 받아 302 리다이렉트.
 * 브라우저는 fresh CDN URL로 직접 가서 이미지 로드.
 *
 * 캐시: 1시간. 같은 영상에 대한 두 번째 요청은 우리 서버를 거치지 않음
 * (브라우저/Next.js fetch cache에서 바로 응답).
 */

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const videoUrl = req.nextUrl.searchParams.get('url');
  if (!videoUrl || !videoUrl.includes('tiktok.com')) {
    return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
  }

  try {
    const apiRes = await fetch(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!apiRes.ok) {
      return NextResponse.json({ error: 'tikwm API failed' }, { status: 502 });
    }
    const apiData = await apiRes.json();
    const coverUrl: string | undefined =
      apiData?.data?.origin_cover || apiData?.data?.cover || apiData?.data?.ai_dynamic_cover;
    if (!coverUrl) {
      return NextResponse.json({ error: 'No cover in response' }, { status: 502 });
    }

    // 302 리다이렉트 + 1시간 캐시. 브라우저가 fresh CDN URL을 직접 받음.
    return NextResponse.redirect(coverUrl, {
      status: 302,
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err) {
    console.error('TikTok thumbnail proxy error:', err);
    return NextResponse.json({ error: 'Failed', details: String(err) }, { status: 500 });
  }
}
