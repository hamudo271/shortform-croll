import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

/**
 * Admin: full member detail with subscription history + recent activity.
 * Returns the unmasked business number — only the listing API masks it.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' } },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const now = new Date();
  const latest = user.subscriptions[0] ?? null;
  const isActive =
    !!latest && latest.status === 'ACTIVE' && latest.endAt > now;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      companyName: user.companyName,
      businessNumber: user.businessNumber, // unmasked in detail view
      lastLoginAt: user.lastLoginAt,
      loginCount: user.loginCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive,
      subscriptions: user.subscriptions,
      activityLogs: user.activityLogs,
    },
  });
}
