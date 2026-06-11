import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_DAYS, SUBSCRIPTION_PRICE_KRW } from '@/lib/auth';

/**
 * 구독 활성화/연장 — 관리자 수동 활성화와 결제 자동활성화가 공유한다.
 * - 활성 구독이 남아있으면 endAt 를 days 만큼 연장
 * - 아니면 now 부터 days 짜리 ACTIVE 구독 신규 생성
 */
export async function activateSubscription(
  userId: string,
  opts: { amount?: number; days?: number; memo?: string } = {},
) {
  const amount = opts.amount ?? SUBSCRIPTION_PRICE_KRW;
  const days = opts.days ?? SUBSCRIPTION_DAYS;
  const now = new Date();
  const addMs = days * 24 * 60 * 60 * 1000;

  const latest = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { endAt: 'desc' },
  });

  const isExtendable = latest && latest.status === 'ACTIVE' && latest.endAt > now;

  if (isExtendable) {
    return prisma.subscription.update({
      where: { id: latest!.id },
      data: {
        endAt: new Date(latest!.endAt.getTime() + addMs),
        memo: opts.memo ?? latest!.memo,
      },
    });
  }
  return prisma.subscription.create({
    data: {
      userId,
      startAt: now,
      endAt: new Date(now.getTime() + addMs),
      status: 'ACTIVE',
      amount,
      memo: opts.memo ?? null,
    },
  });
}
