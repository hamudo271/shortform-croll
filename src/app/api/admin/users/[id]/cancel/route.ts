import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

/**
 * Cancel the user's current active subscription.
 * Sets status=CANCELED and endAt=now (immediate cutoff).
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id: userId } = await context.params;

  const latest = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { endAt: 'desc' },
  });

  if (!latest) {
    return NextResponse.json({ error: '활성 구독이 없습니다' }, { status: 404 });
  }

  const now = new Date();
  const updated = await prisma.subscription.update({
    where: { id: latest.id },
    data: { status: 'CANCELED', endAt: now },
  });

  return NextResponse.json({ success: true, subscription: updated });
}
