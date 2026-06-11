import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, SUBSCRIPTION_PRICE_KRW, SUBSCRIPTION_DAYS } from '@/lib/auth';
import { nicepayClientKey, isNicepayConfigured } from '@/lib/nicepay';

const GOODS_NAME = `스마트렌드 멤버십 (${SUBSCRIPTION_DAYS}일)`;

/**
 * POST /api/payments/nicepay/prepare
 * 결제창을 열기 전 주문을 선등록(금액 서버 고정). returnUrl/clientKey 등 결제창 파라미터 반환.
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!isNicepayConfigured()) {
    return NextResponse.json({ error: '결제가 아직 설정되지 않았습니다.' }, { status: 503 });
  }

  const orderId = `smt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const amount = SUBSCRIPTION_PRICE_KRW;

  await prisma.payment.create({
    data: { orderId, userId: me.id, amount, status: 'PENDING', orderName: GOODS_NAME },
  });

  return NextResponse.json({
    clientKey: nicepayClientKey(),
    orderId,
    amount,
    goodsName: GOODS_NAME,
    buyerEmail: me.email,
    buyerName: me.name || undefined,
  });
}
