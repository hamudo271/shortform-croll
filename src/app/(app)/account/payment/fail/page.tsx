'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function FailInner() {
  const params = useSearchParams();
  const code = params.get('code');
  const message = params.get('message');

  return (
    <div className="max-w-[480px] mx-auto px-5 py-16 text-center">
      <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center text-2xl">×</div>
      <h1 className="text-2xl font-bold text-zinc-50">결제가 취소되었습니다</h1>
      <p className="mt-2 text-sm text-zinc-400">{message || '결제가 완료되지 않았습니다. 다시 시도해주세요.'}</p>
      {code && <p className="mt-1 text-xs text-zinc-600">오류 코드: {code}</p>}
      <div className="mt-6 flex flex-col gap-2">
        <Link href="/account/subscribe" className="h-11 inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
          다시 결제하기
        </Link>
        <Link href="/pricing" className="h-11 inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold transition-colors">
          요금제 보기
        </Link>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-zinc-500">불러오는 중…</div>}>
      <FailInner />
    </Suspense>
  );
}
