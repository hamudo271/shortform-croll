import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';
import { maskBusinessNumber } from '@/lib/profile';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscriptions: {
        orderBy: { endAt: 'desc' },
        take: 1,
      },
      _count: { select: { subscriptions: true, activityLogs: true } },
    },
  });

  // Pull last activity timestamp per user in one batch (avoids N+1).
  const userIds = users.map((u) => u.id);
  const lastActivities = userIds.length
    ? await prisma.activityLog.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _max: { createdAt: true },
      })
    : [];
  const lastActivityByUser = new Map(
    lastActivities.map((row) => [row.userId, row._max.createdAt])
  );

  const now = new Date();
  return NextResponse.json({
    users: users.map((u) => {
      const latest = u.subscriptions[0] ?? null;
      const isActive =
        !!latest && latest.status === 'ACTIVE' && latest.endAt > now;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        phone: u.phone,
        companyName: u.companyName,
        // Mask in list view; full value visible only in detail view.
        businessNumber: maskBusinessNumber(u.businessNumber),
        lastLoginAt: u.lastLoginAt,
        loginCount: u.loginCount,
        createdAt: u.createdAt,
        subscriptionCount: u._count.subscriptions,
        activityCount: u._count.activityLogs,
        lastActivityAt: lastActivityByUser.get(u.id) ?? null,
        subscription: latest
          ? {
              id: latest.id,
              status: latest.status,
              startAt: latest.startAt,
              endAt: latest.endAt,
              amount: latest.amount,
              memo: latest.memo,
              isActive,
            }
          : null,
      };
    }),
  });
}
