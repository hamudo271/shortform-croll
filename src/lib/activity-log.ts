import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

/**
 * Lightweight, fire-and-forget user activity logger.
 *
 * Failures are swallowed (logged to console only) so a logging hiccup
 * never breaks the user-facing flow. Sensitive values (passwords, tokens)
 * MUST never be passed in `metadata` — pass only safe identifiers.
 */
export type ActivityAction =
  | 'LOGIN'
  | 'SIGNUP'
  | 'LOGOUT'
  | 'VIEW_PRODUCT'
  | 'SEARCH'
  | 'PROFILE_UPDATE';

interface LogActivityOptions {
  userId: string;
  action: ActivityAction | string;
  metadata?: Record<string, unknown>;
  request?: NextRequest | Request;
}

function extractIp(request?: NextRequest | Request): string | null {
  if (!request) return null;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip') || null;
}

function extractUa(request?: NextRequest | Request): string | null {
  if (!request) return null;
  const ua = request.headers.get('user-agent');
  return ua ? ua.slice(0, 500) : null;
}

export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        metadata: (opts.metadata as never) ?? undefined,
        ipAddress: extractIp(opts.request),
        userAgent: extractUa(opts.request),
      },
    });
  } catch (err) {
    console.error('logActivity failed:', err);
  }
}
