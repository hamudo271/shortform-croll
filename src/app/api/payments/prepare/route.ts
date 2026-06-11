import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, SUBSCRIPTION_PRICE_KRW, SUBSCRIPTION_DAYS } from '@/lib/auth';
import { tossClientKey } from '@/lib/toss';

const ORDER_NAME = `스마트렌드 멤버십 (${SUBSCRIPTION_DAYS}일)`;

/**
 * POST /api/payments/prepare
 * 결제창을 열기 전 서버가 주문을 선등록한다. 금액을 서버에서 고정해
 * confirm 단계에서 클라이언트 위변조를 차단한다.
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const orderId = `smt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const amount = SUBSCRIPTION_PRICE_KRW;

  await prisma.payment.create({
    data: {
      orderId,
      userId: me.id,
      amount,
      status: 'PENDING',
      orderName: ORDER_NAME,
    },
  });

  return NextResponse.json({
    clientKey: tossClientKey(),
    customerKey: me.id, // 토스 customerKey (회원 식별)
    orderId,
    orderName: ORDER_NAME,
    amount,
    customerEmail: me.email,
    customerName: me.name || undefined,
  });
}
