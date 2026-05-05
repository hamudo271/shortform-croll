import { NextRequest, NextResponse } from 'next/server';

/**
 * TikTok 다운로드 — tikvideo.app/ko로 자동 제출하는 인터스티셜.
 *
 * tikvideo.app은 GET ?url=... 으로 prefill을 안 받지만 폼은 POST q=URL로
 * 결과 페이지를 바로 렌더링해준다. 그래서 우리 쪽에서 작은 HTML을 돌려주고
 * onload 타이밍에 form.submit()을 트리거하면, 사용자는 새 탭이 열리자마자
 * 그 영상의 다운로드 옵션이 나오는 페이지를 보게 된다 (URL 붙여넣기 불필요).
 *
 * 노스크립트 사용자도 안 막히도록 <noscript>에서 직접 클릭할 수 있는 버튼 제공.
 */
export async function GET(req: NextRequest) {
  const videoUrl = req.nextUrl.searchParams.get('url');
  if (!videoUrl || !videoUrl.includes('tiktok.com')) {
    return NextResponse.json({ error: 'Missing or invalid url' }, { status: 400 });
  }

  // 사용자 입력이 그대로 HTML에 들어가므로 quote 이스케이프
  const safeUrl = videoUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;');

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>다운로더로 이동 중…</title>
<style>
  html,body{margin:0;height:100%;background:#0a0a0a;color:#e4e4e7;font-family:-apple-system,system-ui,sans-serif}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
  .spinner{width:36px;height:36px;border:3px solid #27272a;border-top-color:#3b82f6;border-radius:50%;animation:s 1s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  .label{font-size:14px;color:#a1a1aa}
  button{margin-top:8px;background:linear-gradient(to right,#0ea5e9,#2563eb);border:0;color:#fff;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
  noscript .label{color:#fca5a5}
</style>
</head>
<body>
<div class="wrap">
  <div class="spinner"></div>
  <div class="label">tikvideo.app으로 이동 중…</div>
  <form id="f" action="https://tikvideo.app/ko" method="post" target="_self" rel="noopener">
    <input type="hidden" name="q" value="${safeUrl}">
    <input type="hidden" name="lang" value="ko">
    <noscript>
      <div class="label">자동 이동이 차단됐습니다. 아래 버튼을 눌러주세요.</div>
      <button type="submit">다운로더 열기</button>
    </noscript>
  </form>
</div>
<script>document.getElementById('f').submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 인터스티셜이라 캐시 유의미. 같은 영상 재클릭 시 즉시 응답.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
