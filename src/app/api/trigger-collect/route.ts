import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const token = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

    // Parse incoming request body to extract keyword if provided
    let keyword = '';
    try {
      const body = await request.json();
      if (body.keyword) keyword = body.keyword;
    } catch (e) {
      // Ignore JSON parse errors if body is empty
    }

    const payload = keyword ? { keyword } : {};

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
        { error: 'Failed to trigger collection', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Trigger collect error:', error);
    return NextResponse.json(
      { error: 'Internal server error while triggering collection', details: String(error) },
      { status: 500 }
    );
  }
}
