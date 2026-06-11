/**
 * 토스페이먼츠 결제위젯 v2 — 서버 승인.
 *
 * 클라이언트는 결제창만 띄우고, 실제 결제 확정은 반드시 서버가 secret key로
 * /v1/payments/confirm 을 호출해야 한다(클라이언트 successUrl 만으로는 위조 가능).
 *
 * 키는 환경변수로 주입. 기본값은 토스 공개 테스트 키(문서용)라 실제 청구는 안 된다.
 * 라이브 전환: Railway 에 TOSS_CLIENT_KEY / TOSS_SECRET_KEY (실 가맹점 키) 설정.
 */

const TEST_CLIENT_KEY = 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const TEST_SECRET_KEY = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

export function tossClientKey(): string {
  return process.env.TOSS_CLIENT_KEY || TEST_CLIENT_KEY;
}

function tossSecretKey(): string {
  return process.env.TOSS_SECRET_KEY || TEST_SECRET_KEY;
}

/** 테스트 키 사용 중인지(라이브 키 미설정) — UI 배지/안내용. */
export function isTossTestMode(): boolean {
  return (process.env.TOSS_SECRET_KEY || TEST_SECRET_KEY).startsWith('test_');
}

export interface TossConfirmResult {
  ok: boolean;
  status?: number;
  payment?: {
    paymentKey: string;
    orderId: string;
    totalAmount: number;
    status: string;
    method?: string;
  };
  raw?: unknown;
  error?: string;
}

/**
 * 결제 승인. 성공 시 ok=true + payment. 실패 시 ok=false + error(토스 메시지).
 */
export async function confirmTossPayment(input: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResult> {
  const auth = `Basic ${Buffer.from(`${tossSecretKey()}:`).toString('base64')}`;
  try {
    const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentKey: input.paymentKey,
        orderId: input.orderId,
        amount: input.amount,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.message || '결제 승인 실패', raw: data };
    }
    return {
      ok: true,
      status: res.status,
      payment: {
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        totalAmount: Number(data.totalAmount ?? input.amount),
        status: data.status,
        method: data.method,
      },
      raw: data,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '결제 승인 중 오류' };
  }
}
