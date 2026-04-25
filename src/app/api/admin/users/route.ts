import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

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
    },
  });

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
        createdAt: u.createdAt,
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
