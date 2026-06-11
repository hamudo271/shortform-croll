'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const TOSS_SDK = 'https://js.tosspayments.com/v2/standard';

interface PrepareData {
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  customerEmail?: string;
  customerName?: string;
}

// 토스 SDK 타입(필요 부분만)
interface TossWidgets {
  setAmount: (a: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (o: { selector: string; variantKey: string }) => Promise<unknown>;
  renderAgreement: (o: { selector: string; variantKey: string }) => Promise<unknown>;
  requestPayment: (o: Record<string, unknown>) => Promise<void>;
}
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => { widgets: (o: { customerKey: string }) => TossWidgets };
  }
}

function loadTossSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) return resolve();
    const existing = document.querySelector(`script[src="${TOSS_SDK}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('SDK 로드 실패')));
      return;
    }
    const s = document.createElement('script');
    s.src = TOSS_SDK;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('토스 SDK 로드 실패'));
    document.head.appendChild(s);
  });
}

export default function SubscribeCheckoutPage() {
  const [data, setData] = useState<PrepareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState('');
  const widgetsRef = useRef<TossWidgets | null>(null);

  const init = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/payments/prepare', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '주문 생성 실패');
      setData(d);

      await loadTossSdk();
      if (!window.TossPayments) throw new Error('토스 SDK를 불러오지 못했습니다.');
      const toss = window.TossPayments(d.clientKey);
      const widgets = toss.widgets({ customerKey: d.customerKey });
      await widgets.setAmount({ currency: 'KRW', value: d.amount });
      await Promise.all([
        widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
        widgets.renderAgreement({ selector: '#agreement', variantKey: 'DEFAULT' }),
      ]);
      widgetsRef.current = widgets;
    } catch (e) {
      setErr(e instanceof Error ? e.message : '초기화 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const pay = async () => {
    if (!widgetsRef.current || !data) return;
    setPaying(true);
    setErr('');
    try {
      const origin = window.location.origin;
      await widgetsRef.current.requestPayment({
        orderId: data.orderId,
        orderName: data.orderName,
        successUrl: `${origin}/account/payment/success`,
        failUrl: `${origin}/account/payment/fail`,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '결제창을 열지 못했습니다.');
      setPaying(false);
    }
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

      <div className="rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-card">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
          <span className="text-sm font-semibold text-zinc-200">{data?.orderName || '스마트렌드 멤버십'}</span>
          <strong className="text-lg font-bold text-zinc-50 tabular-nums">
            {(data?.amount ?? 29800).toLocaleString('ko-KR')}원
          </strong>
        </div>

        {loading && <div className="py-10 text-center text-sm text-zinc-500">결제 수단을 불러오는 중…</div>}

        {/* 토스 위젯 마운트 지점 */}
        <div id="payment-method" />
        <div id="agreement" className="mt-2" />

        {err && <p className="mt-3 text-xs text-rose-500">{err}</p>}

        {!loading && !err && (
          <button
            onClick={pay}
            disabled={paying}
            className="mt-4 w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
          >
            {paying ? '결제창 여는 중…' : `${(data?.amount ?? 29800).toLocaleString('ko-KR')}원 결제하기`}
          </button>
        )}

        {err && (
          <button
            onClick={init}
            className="mt-2 w-full h-10 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold transition-colors"
          >
            다시 시도
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-zinc-600">
        토스페이먼츠 안전 결제 · 자동 갱신 없음 · 28일 후 만료
      </p>
    </div>
  );
}
