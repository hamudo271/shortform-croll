import { NextRequest, NextResponse } from 'next/server';

// 수집은 ~60초 걸림 — Vercel/Railway 기본 타임아웃 회피
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const token = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

    let keyword = '';
    try {
      const body = await request.json();
      if (body.keyword) keyword = body.keyword;
    } catch {
      // Empty body is OK
    }

    const payload: Record<string, string> = {};
    if (keyword) payload.keyword = keyword;

    // Self-loopback: Railway 컨테이너에서 ${origin} 으로 자기 자신을 호출하면
    // 프록시 레이어가 fetch failed 로 끊는다. localhost:PORT로 직접 호출하면
    // 같은 Node 프로세스의 다른 라우트로 가서 안정적.
    const port = process.env.PORT || '3000';
    const url = `http://127.0.0.1:${port}/api/collect`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: '데이터 수집에 실패했습니다', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Trigger collect error:', error);
    return NextResponse.json(
      { error: '데이터 수집 중 오류가 발생했습니다', details: String(error) },
      { status: 500 }
    );
  }
}
