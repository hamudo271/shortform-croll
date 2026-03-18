import { NextRequest, NextResponse } from 'next/server';
import { generateToken, getSessionCookieOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const validUsername = process.env.AUTH_USERNAME || 'admin';
    const validPassword = process.env.AUTH_PASSWORD || '28319jjkk';

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 틀렸습니다' },
        { status: 401 }
      );
    }

    const token = generateToken(username);
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({ success: true, username });
    response.cookies.set(cookieOptions.name, token, cookieOptions);

    return response;
  } catch {
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}
