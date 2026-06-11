import crypto from 'crypto';

/**
 * 나이스페이먼츠(NICEPAY) v2 일반결제(결제창) — 서버 승인.
 *
 * 흐름: 클라이언트가 결제창(AUTHNICE.requestPay)으로 인증 → 나이스페이가 returnUrl 로
 * 인증결과(authResultCode, tid, amount, signature 등) POST → 서버가 승인 API
 * (/v1/payments/{tid}) 를 호출해야 결제가 최종 확정된다. (returnUrl 만으로는 미완료)
 *
 * 키: NICEPAY_CLIENT_KEY / NICEPAY_SECRET_KEY / NICEPAY_MODE(live|sandbox).
 */

export function nicepayClientKey(): string {
  return process.env.NICEPAY_CLIENT_KEY || '';
}
function nicepaySecretKey(): string {
  return process.env.NICEPAY_SECRET_KEY || '';
}
export function nicepayMode(): 'live' | 'sandbox' {
  // 운영 키를 기본으로(사용자 선택). 명시적으로 sandbox 지정 시에만 샌드박스.
  return process.env.NICEPAY_MODE === 'sandbox' ? 'sandbox' : 'live';
}
function apiBase(): string {
  return nicepayMode() === 'live' ? 'https://api.nicepay.co.kr' : 'https://sandbox-api.nicepay.co.kr';
}
function authHeader(): string {
  return `Basic ${Buffer.from(`${nicepayClientKey()}:${nicepaySecretKey()}`).toString('base64')}`;
}

export function isNicepayConfigured(): boolean {
  return !!nicepayClientKey() && !!nicepaySecretKey();
}

function sha256hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * 결제창 인증결과 signature 검증.
 * NICEPAY: signature = hex(SHA256(authToken + clientId + amount + secretKey))
 */
export function verifyAuthSignature(input: {
  authToken: string;
  amount: string | number;
  signature: string;
}): boolean {
  if (!input.signature || !input.authToken) return false;
  const expected = sha256hex(
    `${input.authToken}${nicepayClientKey()}${input.amount}${nicepaySecretKey()}`,
  );
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(input.signature, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface NicepayApproveResult {
  ok: boolean;
  resultCode?: string;
  status?: string; // paid | ready | ...
  amount?: number;
  tid?: string;
  method?: string;
  raw?: unknown;
  error?: string;
}

/**
 * 결제 승인. /v1/payments/{tid} 에 { amount } 로 POST. resultCode "0000" = 성공.
 */
export async function approveNicepay(tid: string, amount: number): Promise<NicepayApproveResult> {
  try {
    const res = await fetch(`${apiBase()}/v1/payments/${encodeURIComponent(tid)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: authHeader(),
      },
      body: JSON.stringify({ amount }),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    const resultCode = String(data.resultCode || data.ResultCode || '');
    const paidAmount = Number(data.amount ?? data.Amount ?? amount);
    const status = String(data.status || data.Status || '');
    if (resultCode !== '0000') {
      return {
        ok: false,
        resultCode,
        error: String(data.resultMsg || data.ResultMsg || '승인 실패'),
        raw: data,
      };
    }
    return {
      ok: true,
      resultCode,
      status,
      amount: paidAmount,
      tid: String(data.tid || data.TID || tid),
      method: String(data.payMethod || data.method || ''),
      raw: data,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '승인 중 오류' };
  }
}
