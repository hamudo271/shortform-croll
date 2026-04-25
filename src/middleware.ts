import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware: lightweight auth gate only.
 * Subscription/role checks happen in server layouts (need DB).
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  const { pathname } = request.nextUrl;

  // Marketing / auth pages (no auth required)
  const isMarketing = pathname === '/' || pathname === '/pricing';
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isAuthApi = pathname.startsWith('/api/auth/');

  // /login & /signup: bounce away if already logged in
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Public routes — pass through. Logged-in users see different header CTAs
  // but the marketing pages are intentionally always accessible.
  if (isMarketing || isAuthPage || isAuthApi) {
    return NextResponse.next();
  }

  // Protected routes: /dashboard, /account, /admin (and any future /)
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/pricing',
    '/dashboard/:path*',
    '/account/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/api/auth/:path*',
  ],
};
