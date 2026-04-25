import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';
import { SUBSCRIPTION_DAYS, SUBSCRIPTION_PRICE_KRW } from '@/lib/auth';

/**
 * Activate or extend a user's subscription by 28 days.
 * - If the user has an ACTIVE subscription that hasn't expired, extend its endAt by 28 days.
 * - Otherwise create a fresh ACTIVE subscription starting now.
 *
 * Body (optional): { memo?: string, amount?: number, days?: number }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id: userId } = await context.params;

  let memo: string | undefined;
  let amount: number = SUBSCRIPTION_PRICE_KRW;
  let days: number = SUBSCRIPTION_DAYS;
  try {
    const body = await request.json();
    if (typeof body?.memo === 'string') memo = body.memo.slice(0, 200);
    if (typeof body?.amount === 'number' && body.amount >= 0) amount = body.amount;
    if (typeof body?.days === 'number' && body.days > 0 && body.days <= 365) {
      days = Math.floor(body.days);
    }
  } catch {
    // empty body is OK
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const now = new Date();
  const addMs = days * 24 * 60 * 60 * 1000;

  // Find latest sub
  const latest = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { endAt: 'desc' },
  });

  const isExtendable =
    latest && latest.status === 'ACTIVE' && latest.endAt > now;

  let subscription;
  if (isExtendable) {
    subscription = await prisma.subscription.update({
      where: { id: latest!.id },
      data: {
        endAt: new Date(latest!.endAt.getTime() + addMs),
        memo: memo ?? latest!.memo,
      },
    });
  } else {
    subscription = await prisma.subscription.create({
      data: {
        userId,
        startAt: now,
        endAt: new Date(now.getTime() + addMs),
        status: 'ACTIVE',
        amount,
        memo: memo ?? null,
      },
    });
  }

  return NextResponse.json({ success: true, subscription });
}
