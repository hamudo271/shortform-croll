import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { activateSubscription } from '@/lib/subscription';

/**
 * 나이스페이 웹훅 수신.
 *
 * 용도: 가상계좌 입금완료처럼 returnUrl 흐름 밖에서 발생하는 결제완료를 서버가 따로 통보받아
 * 구독을 자동 활성화한다(누락 방지). 카드 결제는 returnUrl 에서 이미 승인·활성화됨.
 *
 * 보안: 주문(orderId)은 선등록된 PENDING 건이어야 하고 금액이 서버 기대값과 일치해야 활성화한다.
 * orderId 는 추측 불가한 랜덤값. (서명 검증은 NICEPAY 웹훅 스펙 확정 후 강화 예정)
 *
 * 응답: 나이스페이는 HTTP 200 수신 시 정상 처리로 간주하므로 항상 200("OK") 반환.
 */

const SUCCESS_STATUS = new Set(['paid', 'done', 'deposit', 'vbankdeposit']);

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v) !== '') return String(v);
  }
  return '';
}

export async function GET() {
  return new NextResponse('OK', { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};
    if (ct.includes('application/json')) {
      body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    } else {
      const form = await req.formData().catch(() => null);
      if (form) for (const [k, v] of form.entries()) body[k] = typeof v === 'string' ? v : '';
    }

    const orderId = pick(body, ['orderId', 'OrderId', 'moid', 'Moid']);
    const tid = pick(body, ['tid', 'TID', 'Tid']);
    const amount = Number(pick(body, ['amount', 'Amount', 'goodsAmt']) || '0');
    const statusRaw = pick(body, ['status', 'Status', 'resultCode', 'ResultCode']).toLowerCase();
    const success = SUCCESS_STATUS.has(statusRaw) || statusRaw === '0000';

    console.log('[nicepay webhook]', { orderId, tid, amount, statusRaw });

    if (orderId && success) {
      const order = await prisma.payment.findUnique({ where: { orderId } });
      if (order && order.status !== 'PAID' && amount === order.amount) {
        await prisma.payment.update({
          where: { orderId },
          data: { status: 'PAID', paymentKey: tid || order.paymentKey, raw: body as Prisma.InputJsonValue },
        });
        await activateSubscription(order.userId, { amount: order.amount, memo: `나이스페이(웹훅) ${orderId}` });
      }
    }
  } catch (e) {
    console.error('[nicepay webhook] error:', e);
  }

  // 나이스페이는 200 을 받아야 재전송하지 않음
  return new NextResponse('OK', { status: 200 });
}
