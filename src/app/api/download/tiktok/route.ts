import { NextRequest, NextResponse } from 'next/server';

/**
 * TikTok video download proxy.
 *
 * Click 한 번이면 워터마크 없는 MP4가 곧장 다운로드되도록 — 3rd-party
 * 다운로더 사이트로 이동하지 않는다.
 *
 * 흐름:
 * 1. 영상 URL을 tikwm API에 넘겨 직접 다운로드 가능한 play URL을 받음
 * 2. 그 URL의 바이트를 그대로 프록시하면서 Content-Disposition: attachment
 *    헤더를 붙여 브라우저가 "다른 이름으로 저장" 동작을 트리거하게 함
 *
 * 비용: 영상당 2~5MB 트래픽. 호출량이 늘면 캐싱/직접 redirect 검토.
 */

// 다운로드는 시간이 좀 걸릴 수 있어 maxDuration 넉넉히
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const videoUrl = req.nextUrl.searchParams.get('url');
  if (!videoUrl || !videoUrl.includes('tiktok.com')) {
    return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
  }

  try {
    // 1) tikwm API로 play URL 가져오기 (hd=1로 고화질 우선)
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}&hd=1`;
    const apiRes = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!apiRes.ok) {
      return NextResponse.json({ error: 'tikwm API failed', status: apiRes.status }, { status: 502 });
    }
    const apiData = await apiRes.json();
    const playUrl: string | undefined = apiData?.data?.hdplay || apiData?.data?.play || apiData?.data?.wmplay;
    if (!playUrl) {
      return NextResponse.json({ error: 'Video URL not found in tikwm response' }, { status: 502 });
    }

    // 2) MP4 바이트를 프록시해서 attachment로 내려보내기
    const videoRes = await fetch(playUrl);
    if (!videoRes.ok || !videoRes.body) {
      return NextResponse.json({ error: 'Could not fetch video bytes' }, { status: 502 });
    }

    // 파일명: 영상 ID 우선, 없으면 timestamp
    const videoId = String(apiData?.data?.id || Date.now());
    const filename = `tiktok_${videoId}.mp4`;

    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    const len = videoRes.headers.get('content-length');
    if (len) headers.set('Content-Length', len);
    headers.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(videoRes.body, { status: 200, headers });
  } catch (err) {
    console.error('TikTok download proxy error:', err);
    return NextResponse.json({ error: 'Download failed', details: String(err) }, { status: 500 });
  }
}
