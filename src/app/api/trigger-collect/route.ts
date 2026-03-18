import { NextRequest, NextResponse } from 'next/server';

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

    // Always use KR geo
    const payload: Record<string, string> = { geo: 'KR' };
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
