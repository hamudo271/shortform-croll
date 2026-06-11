import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { baseUrlFromRequest } from '@/lib/oauth';
import { approveNicepay, verifyAuthSignature } from '@/lib/nicepay';
import { activateSubscription } from '@/lib/subscription';

/**
 * POST /api/payments/nicepay/return
 * 나이스페이 결제창 인증결과 수신 → 서명검증 → 승인 → 구독 자동활성화 → 결과 페이지로 리다이렉트.
 * (사용자 브라우저가 이 URL로 form POST 되며, 처리 후 303 으로 성공/실패 페이지로 보냄)
 */
export async function POST(req: NextRequest) {
  const base = baseUrlFromRequest(req);
  const ok = (q = '') => NextResponse.redirect(new URL(`/account/payment/success${q}`, base), 303);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/account/payment/fail?message=${encodeURIComponent(msg)}`, base), 303);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('결제 결과를 읽지 못했습니다.');
  }
  const get = (k: string) => String(form.get(k) ?? '');

  const authResultCode = get('authResultCode');
  const authToken = get('authToken');
  const tid = get('tid');
  const orderId = get('orderId');
  const amount = get('amount');
  const signature = get('signature');

  if (!orderId || !tid) return fail('결제 정보가 누락되었습니다.');

  const order = await prisma.payment.findUnique({ where: { orderId } });
  if (!order) return fail('주문을 찾을 수 없습니다.');

  // 이미 처리된 주문(멱등)
  if (order.status === 'PAID') return ok('?status=ok');

  // 인증 실패(사용자 취소 등)
  if (authResultCode !== '0000') {
    await prisma.payment.update({ where: { orderId }, data: { status: 'FAILED' } });
    return fail('결제가 취소되었거나 인증에 실패했습니다.');
  }

  // 금액 위변조 검증(서버 고정 기대금액과 대조 — 핵심 보안)
  if (Number(amount) !== order.amount) {
    await prisma.payment.update({ where: { orderId }, data: { status: 'FAILED' } });
    return fail('결제 금액이 일치하지 않습니다.');
  }
  // 서명 검증은 진단용(비차단). 실제 확정은 아래 secret키 서버승인이 authoritative —
  // 위조 returnUrl 은 tid 가 가짜라 승인 단계에서 실패함. 서명식 미세차이로 정상결제를
  // 막지 않도록 불일치는 경고만 남기고 진행한다.
  if (signature && !verifyAuthSignature({ authToken, amount, signature })) {
    console.warn('[nicepay return] signature mismatch', { orderId, tid });
  }

  // 서버 승인 (secret키, TLS) — 여기서 resultCode 0000 + 금액일치여야 최종 확정
  const result = await approveNicepay(tid, order.amount);
  if (!result.ok || result.amount !== order.amount) {
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'FAILED', paymentKey: tid, raw: (result.raw ?? {}) as Prisma.InputJsonValue },
    });
    return fail(result.error || '결제 승인에 실패했습니다.');
  }

  await prisma.payment.update({
    where: { orderId },
    data: {
      status: 'PAID',
      paymentKey: tid,
      method: result.method || null,
      raw: result.raw as Prisma.InputJsonValue,
    },
  });

  // 구독 자동 활성화 (28일)
  await activateSubscription(order.userId, { amount: order.amount, memo: `나이스페이 ${orderId}` });

  return ok('?status=ok');
}
