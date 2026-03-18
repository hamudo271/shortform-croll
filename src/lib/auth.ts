import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE = 'session_token';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.COLLECT_API_KEY || 'fallback-secret';
}

export function generateToken(username: string): string {
  const payload = `${username}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

export function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 3) return false;

    const signature = parts.pop()!;
    const payload = parts.join(':');

    const hmac = crypto.createHmac('sha256', getSecret());
    hmac.update(payload);
    const expected = hmac.digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function getSession(): Promise<{ authenticated: boolean; username?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token || !verifyToken(token)) {
    return { authenticated: false };
  }

  const decoded = Buffer.from(token, 'base64').toString('utf-8');
  const username = decoded.split(':')[0];
  return { authenticated: true, username };
}

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE,
    path: '/',
  };
}
