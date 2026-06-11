'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type State = 'confirming' | 'success' | 'error';

function SuccessInner() {
  const params = useSearchParams();
  const [state, setState] = useState<State>('confirming');
  const [message, setMessage] = useState('');
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    // 나이스페이: 승인·활성화가 returnUrl(서버)에서 이미 끝나고 ?status=ok 로 옴 → 바로 성공 표시
    if (params.get('status') === 'ok') {
      setState('success');
      return;
    }

    const paymentKey = params.get('paymentKey');
    const orderId = params.get('orderId');
    const amount = params.get('amount');
    if (!paymentKey || !orderId || !amount) {
      setState('error');
      setMessage('결제 정보가 올바르지 않습니다.');
      return;
    }

    (async () => {
      try {
        const r = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || '결제 승인 실패');
        setState('success');
      } catch (e) {
        setState('error');
        setMessage(e instanceof Error ? e.message : '결제 승인 중 오류가 발생했습니다.');
      }
    })();
  }, [params]);

  return (
    <div className="max-w-[480px] mx-auto px-5 py-16 text-center">
      {state === 'confirming' && (
        <>
          <div className="mx-auto mb-5 w-12 h-12 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
          <h1 className="text-xl font-bold text-zinc-50">결제를 확인하는 중…</h1>
          <p className="mt-2 text-sm text-zinc-400">잠시만 기다려주세요.</p>
        </>
      )}

      {state === 'success' && (
        <>
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-2xl">✓</div>
          <h1 className="text-2xl font-bold text-zinc-50">결제가 완료되었습니다</h1>
          <p className="mt-2 text-sm text-zinc-400">멤버십이 활성화되었습니다. 지금 바로 이용해보세요.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/dashboard" className="h-11 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
              대시보드로 이동
            </Link>
            <Link href="/dashboard/community" className="h-11 inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold transition-colors">
              커뮤니티 둘러보기
            </Link>
          </div>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center text-2xl">!</div>
          <h1 className="text-2xl font-bold text-zinc-50">결제 확인 실패</h1>
          <p className="mt-2 text-sm text-zinc-400">{message}</p>
          <p className="mt-1 text-xs text-zinc-500">결제가 진행됐는데 활성화되지 않았다면 관리자에게 문의해주세요.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/account/subscribe" className="h-11 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
              다시 결제하기
            </Link>
            <Link href="/account" className="h-11 inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold transition-colors">
              내 정보로
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-zinc-500">불러오는 중…</div>}>
      <SuccessInner />
    </Suspense>
  );
}
