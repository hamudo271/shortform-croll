'use client';

import { useCallback, useEffect, useState } from 'react';

const NICEPAY_SDK = 'https://pay.nicepay.co.kr/v1/js/';

interface PrepareData {
  clientKey: string;
  orderId: string;
  amount: number;
  goodsName: string;
  buyerEmail?: string;
  buyerName?: string;
}

interface AuthNice {
  requestPay: (opts: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    AUTHNICE?: AuthNice;
  }
}

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AUTHNICE) return resolve();
    const existing = document.querySelector(`script[src="${NICEPAY_SDK}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('SDK 로드 실패')));
      return;
    }
    const s = document.createElement('script');
    s.src = NICEPAY_SDK;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('나이스페이 SDK 로드 실패'));
    document.head.appendChild(s);
  });
}

export default function SubscribeCheckoutPage() {
  const [data, setData] = useState<PrepareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState('');

  const init = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      await loadSdk();
      const r = await fetch('/api/payments/nicepay/prepare', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '주문 생성 실패');
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '초기화 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const pay = () => {
    if (!data || !window.AUTHNICE) return;
    setPaying(true);
    setErr('');
    const origin = window.location.origin;
    window.AUTHNICE.requestPay({
      clientId: data.clientKey,
      method: 'card',
      orderId: data.orderId,
      amount: data.amount,
      goodsName: data.goodsName,
      returnUrl: `${origin}/api/payments/nicepay/return`,
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      fnError: (result: { errorMsg?: string; resultMsg?: string }) => {
        setErr(result?.errorMsg || result?.resultMsg || '결제창을 열지 못했습니다.');
        setPaying(false);
      },
    });
  };

  return (
    <div className="max-w-[560px] mx-auto px-5 py-10">
      <div className="text-center mb-6">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-blue-500 mb-2">Membership</p>
        <h1 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 tracking-[-0.02em]">멤버십 결제</h1>
        <p className="text-sm text-zinc-400 mt-2">
          결제 즉시 28일 멤버십이 활성화되어 상품 DB·커뮤니티를 이용할 수 있습니다.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-card">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
          <span className="text-sm font-semibold text-zinc-200">{data?.goodsName || '스마트렌드 멤버십'}</span>
          <strong className="text-lg font-bold text-zinc-50 tabular-nums">
            {(data?.amount ?? 29800).toLocaleString('ko-KR')}원
          </strong>
        </div>

        {err && <p className="mb-3 text-xs text-rose-500">{err}</p>}

        <button
          onClick={pay}
          disabled={loading || paying || !data}
          className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
        >
          {loading ? '준비 중…' : paying ? '결제창 여는 중…' : `${(data?.amount ?? 29800).toLocaleString('ko-KR')}원 결제하기`}
        </button>

        {err && !loading && (
          <button
            onClick={init}
            className="mt-2 w-full h-10 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold transition-colors"
          >
            다시 시도
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-zinc-600">
        나이스페이먼츠 안전 결제 · 자동 갱신 없음 · 28일 후 만료
      </p>
    </div>
  );
}
