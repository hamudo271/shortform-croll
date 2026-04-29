import { cookies } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { Role, SubscriptionStatus } from '@prisma/client';

const SESSION_COOKIE = 'session_token';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const BCRYPT_ROUNDS = 10;

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.COLLECT_API_KEY || 'fallback-secret';
}

/**
 * Token format: base64(`${userId}:${issuedAt}:${signature}`)
 */
export function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

interface ParsedToken {
  userId: string;
  issuedAt: number;
}

/**
 * Verify signature and return parsed payload, or null if invalid.
 * Pure crypto — does NOT touch the DB. Safe for middleware.
 */
export function parseAndVerifyToken(token: string): ParsedToken | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 3) return null;

    const signature = parts.pop()!;
    const payload = parts.join(':');

    const hmac = crypto.createHmac('sha256', getSecret());
    hmac.update(payload);
    const expected = hmac.digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const [userId, issuedAtStr] = payload.split(':');
    const issuedAt = parseInt(issuedAtStr, 10);
    if (!userId || Number.isNaN(issuedAt)) return null;
    return { userId, issuedAt };
  } catch {
    return null;
  }
}

/** Backward-compatible boolean check (no DB). */
export function verifyToken(token: string): boolean {
  return parseAndVerifyToken(token) !== null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  hasActiveSubscription: boolean;
  subscriptionEndAt: Date | null;
  subscriptionStatus: SubscriptionStatus | null;
}

/**
 * Returns the logged-in user with current subscription status.
 * Hits the DB. Use in server components / API routes (NOT middleware).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const parsed = parseAndVerifyToken(token);
  if (!parsed) return null;

  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    include: {
      subscriptions: {
        orderBy: { endAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!user) return null;

  const latest = user.subscriptions[0] ?? null;
  const now = new Date();
  const hasActiveSubscription =
    !!latest && latest.status === 'ACTIVE' && latest.endAt > now;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hasActiveSubscription,
    subscriptionEndAt: latest?.endAt ?? null,
    subscriptionStatus: latest?.status ?? null,
  };
}

/**
 * Backward-compat: legacy callers used getSession() returning {authenticated, username}.
 * Now returns email instead of username.
 */
export async function getSession(): Promise<{
  authenticated: boolean;
  userId?: string;
  email?: string;
  name?: string | null;
  role?: Role;
  hasActiveSubscription?: boolean;
  subscriptionEndAt?: Date | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { authenticated: false };
  return {
    authenticated: true,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hasActiveSubscription: user.hasActiveSubscription,
    subscriptionEndAt: user.subscriptionEndAt,
  };
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

export const SUBSCRIPTION_DAYS = 28;
export const SUBSCRIPTION_PRICE_KRW = 29_800;
export const SUBSCRIPTION_ORIGINAL_PRICE_KRW = 57_000;
export const TRIAL_DAYS = 7;
