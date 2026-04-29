import { NextRequest, NextResponse } from 'next/server';

// 수집은 ~60초 걸림 — Vercel/Railway 기본 타임아웃 회피
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const token = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

    let keyword = '';
    try {
      const body = await request.json();
      if (body.keyword) keyword = body.keyword;
    } catch {
      // Empty body is OK
    }

    // 해외 풀 (collect/route.ts의 기본값 = 'US')
    const payload: Record<string, string> = {};
    if (keyword) payload.keyword = keyword;

    const response = await fetch(`${origin}/api/collect`, {
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
