import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { authorizeUrl, isOAuthProvider, baseUrlFromRequest } from '@/lib/oauth';

/**
 * GET /api/auth/google | /api/auth/naver
 * state(CSRF) 쿠키를 심고 공급자 동의 화면으로 리다이렉트.
 * (정적 형제 라우트 login/logout/me/signup 이 우선 매칭되므로 충돌 없음)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  try {
    const state = crypto.randomBytes(16).toString('hex');
    const res = NextResponse.redirect(authorizeUrl(provider, state, req));
    res.cookies.set(`oauth_state_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    return res;
  } catch (e) {
    const base = baseUrlFromRequest(req);
    const msg = e instanceof Error ? e.message : 'oauth_init_failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, base));
  }
}
