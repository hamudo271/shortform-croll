import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, getSessionCookieOptions } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import {
  isOAuthProvider,
  fetchOAuthProfile,
  upsertOAuthUser,
  baseUrlFromRequest,
} from '@/lib/oauth';

/**
 * GET /api/auth/google/callback | /api/auth/naver/callback
 * state 검증 → 토큰교환·프로필 → 유저 연결/생성 → 세션 쿠키 발급 → /dashboard.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const base = baseUrlFromRequest(req);

  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL('/login?error=unknown_provider', base));
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get(`oauth_state_${provider}`)?.value;

  // 사용자가 동의 취소한 경우 등
  const oauthError = req.nextUrl.searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(new URL('/login?error=oauth_canceled', base));
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL('/login?error=oauth_state', base));
  }

  try {
    const profile = await fetchOAuthProfile(provider, code, state, req);
    const userId = await upsertOAuthUser(profile);

    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });
    void logActivity({ userId, action: 'LOGIN', request: req });

    const token = generateToken(userId);
    const opts = getSessionCookieOptions();

    const res = NextResponse.redirect(new URL('/dashboard', base));
    res.cookies.set(opts.name, token, opts);
    res.cookies.set(`oauth_state_${provider}`, '', { maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, base));
  }
}
