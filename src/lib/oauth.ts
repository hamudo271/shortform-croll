import { prisma } from '@/lib/prisma';

/**
 * 구글 / 네이버 소셜 로그인.
 *
 * 흐름: /api/auth/<provider> (state 쿠키 + authorize 리다이렉트)
 *      → 공급자 동의 → /api/auth/<provider>/callback (state 검증 + 토큰교환 + 프로필 → 유저 upsert + 세션)
 *
 * 키는 환경변수: GOOGLE_CLIENT_ID/SECRET, NAVER_CLIENT_ID/SECRET.
 * redirect_uri 는 요청 origin 기반으로 자동 생성(env APP_URL/NEXTAUTH_URL 우선) →
 * 구글/네이버 콘솔에 "<base>/api/auth/google|naver/callback" 을 등록해야 한다.
 */

export type OAuthProvider = 'google' | 'naver';

export function isOAuthProvider(v: string): v is OAuthProvider {
  return v === 'google' || v === 'naver';
}

interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name?: string;
  profileImage?: string;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  return v;
}

function credentials(provider: OAuthProvider): { clientId: string; clientSecret: string } {
  if (provider === 'google') {
    return { clientId: env('GOOGLE_CLIENT_ID'), clientSecret: env('GOOGLE_CLIENT_SECRET') };
  }
  return { clientId: env('NAVER_CLIENT_ID'), clientSecret: env('NAVER_CLIENT_SECRET') };
}

/**
 * 요청 기준 base URL (프록시 뒤에서도 안전).
 * redirect_uri 는 브라우저가 실제로 있는 위치와 일치해야 하므로 요청 헤더에서 도출한다
 * (env 고정값을 쓰면 로컬에서 prod URL 로 잘못 리다이렉트됨). 명시적 강제만 OAUTH_BASE_URL 로.
 */
export function baseUrlFromRequest(req: Request): string {
  const forced = process.env.OAUTH_BASE_URL;
  if (forced) return forced.replace(/\/$/, '');
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') || 'https';
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export function redirectUri(provider: OAuthProvider, req: Request): string {
  return `${baseUrlFromRequest(req)}/api/auth/${provider}/callback`;
}

/** authorize 화면 URL 생성. */
export function authorizeUrl(provider: OAuthProvider, state: string, req: Request): string {
  const { clientId } = credentials(provider);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri(provider, req),
    state,
  });
  if (provider === 'google') {
    params.set('scope', 'openid email profile');
    params.set('prompt', 'select_account');
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  return `https://nid.naver.com/oauth2.0/authorize?${params}`;
}

async function exchangeGoogle(code: string, req: Request): Promise<OAuthProfile> {
  const { clientId, clientSecret } = credentials('google');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri('google', req),
      grant_type: 'authorization_code',
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(token.error_description || token.error || '구글 토큰 교환 실패');

  const profRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const p = await profRes.json();
  if (!profRes.ok) throw new Error('구글 프로필 조회 실패');
  return {
    provider: 'google',
    providerId: String(p.sub),
    email: String(p.email || '').toLowerCase(),
    name: p.name,
    profileImage: p.picture,
  };
}

async function exchangeNaver(code: string, state: string): Promise<OAuthProfile> {
  const { clientId, clientSecret } = credentials('naver');
  const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
  tokenUrl.search = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    state,
  }).toString();

  const tokenRes = await fetch(tokenUrl);
  const token = await tokenRes.json();
  if (!tokenRes.ok || token.error) {
    throw new Error(token.error_description || token.error || '네이버 토큰 교환 실패');
  }

  const profRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const p = await profRes.json();
  if (!profRes.ok || p.resultcode !== '00') throw new Error(p.message || '네이버 프로필 조회 실패');
  const r = p.response;
  return {
    provider: 'naver',
    providerId: String(r.id),
    email: String(r.email || '').toLowerCase(),
    name: r.name || r.nickname,
    profileImage: r.profile_image,
  };
}

export async function fetchOAuthProfile(
  provider: OAuthProvider,
  code: string,
  state: string,
  req: Request,
): Promise<OAuthProfile> {
  return provider === 'google' ? exchangeGoogle(code, req) : exchangeNaver(code, state);
}

/**
 * 소셜 프로필 → User 연결/생성. providerId 우선 매칭, 없으면 email 로 기존계정 연결,
 * 그래도 없으면 신규 생성(비밀번호 없는 소셜 전용 계정). 반환: userId.
 */
export async function upsertOAuthUser(profile: OAuthProfile): Promise<string> {
  if (!profile.email) throw new Error('이메일 제공에 동의해야 가입할 수 있습니다.');

  // 1) 이미 연결된 소셜 계정
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider: profile.provider, providerId: profile.providerId } },
  });
  if (existing) {
    if (profile.profileImage) {
      await prisma.user.update({
        where: { id: existing.userId },
        data: { profileImage: profile.profileImage },
      });
    }
    return existing.userId;
  }

  // 2) 같은 이메일의 기존 유저가 있으면 연결, 없으면 신규 생성
  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        profileImage: profile.profileImage || null,
        passwordHash: null,
      },
    });
  }

  await prisma.oAuthAccount.create({
    data: {
      provider: profile.provider,
      providerId: profile.providerId,
      userId: user.id,
      email: profile.email,
      name: profile.name || null,
    },
  });

  return user.id;
}
