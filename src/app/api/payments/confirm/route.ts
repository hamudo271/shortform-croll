import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { confirmTossPayment } from '@/lib/toss';
import { activateSubscription } from '@/lib/subscription';
import type { Prisma } from '@prisma/client';

/**
 * POST /api/payments/confirm  { paymentKey, orderId, amount }
 *
 * 결제 최종 확정. 보안 핵심:
 * - 주문이 현재 로그인 유저의 것인지 확인
 * - 금액을 서버에 저장된 기대 금액과 대조(위변조 차단)
 * - 멱등 처리: 이미 PAID 면 재승인 없이 성공 반환
 * - 토스 승인 성공 시에만 구독 자동 활성화
 */
export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  let body: { paymentKey?: string; orderId?: string; amount?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const paymentKey = String(body.paymentKey || '');
  const orderId = String(body.orderId || '');
  const amount = Number(body.amount);
  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return NextResponse.json({ error: '결제 정보가 누락되었습니다.' }, { status: 400 });
  }

  const order = await prisma.payment.findUnique({ where: { orderId } });
  if (!order || order.userId !== me.id) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 멱등: 이미 결제 완료된 주문
  if (order.status === 'PAID') {
    return NextResponse.json({ success: true, alreadyConfirmed: true });
  }

  // 위변조 차단: 클라이언트가 보낸 금액과 서버 기대 금액 일치 확인
  if (amount !== order.amount) {
    return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
  }

  const result = await confirmTossPayment({ paymentKey, orderId, amount: order.amount });

  if (!result.ok || !result.payment) {
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'FAILED', raw: (result.raw ?? { error: result.error }) as Prisma.InputJsonValue },
    });
    return NextResponse.json({ error: result.error || '결제 승인에 실패했습니다.' }, { status: 402 });
  }

  // 토스가 확정한 실제 금액도 재대조
  if (result.payment.totalAmount !== order.amount) {
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'FAILED', raw: result.raw as Prisma.InputJsonValue },
    });
    return NextResponse.json({ error: '승인 금액 불일치' }, { status: 400 });
  }

  await prisma.payment.update({
    where: { orderId },
    data: {
      status: 'PAID',
      paymentKey: result.payment.paymentKey,
      method: result.payment.method || null,
      raw: result.raw as Prisma.InputJsonValue,
    },
  });

  // 구독 자동 활성화 (28일)
  await activateSubscription(me.id, { amount: order.amount, memo: `토스결제 ${orderId}` });

  return NextResponse.json({ success: true });
}
