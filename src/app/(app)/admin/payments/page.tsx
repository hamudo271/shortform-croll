import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHeader from '@/components/app/PageHeader';
import { formatDate, getRelativeTime } from '@/lib/utils';
import { ChevronRight } from '@/components/ui/Icon';

// 결제(PG) 내역 조회 — admin layout 이 ADMIN 게이트를 이미 수행.
// 수동 구독 부여는 Payment 를 만들지 않으므로 여기는 나이스페이/토스 결제만 보인다.
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PAID: { label: '결제완료', cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/30' },
  PENDING: { label: '대기', cls: 'bg-zinc-500/10 text-zinc-400 border border-zinc-600/30' },
  FAILED: { label: '실패', cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/30' },
  CANCELED: { label: '취소', cls: 'bg-zinc-500/10 text-zinc-400 border border-zinc-600/30' },
};

export default async function AdminPaymentsPage() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { email: true, name: true } } },
  });

  const paidTotal = payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-10 space-y-8">
      <nav className="text-xs text-zinc-400 flex items-center gap-1.5">
        <Link href="/admin" className="hover:text-zinc-100">관리자</Link>
        <ChevronRight size={12} />
        <span className="text-zinc-300">결제 내역</span>
      </nav>

      <PageHeader title="결제 내역" accent="PG 결제" emoji="💳" />

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: '전체 결제 시도', value: payments.length.toLocaleString() },
          { label: '결제 완료', value: payments.filter((p) => p.status === 'PAID').length.toLocaleString() },
          { label: '완료 금액 합계', value: `${paidTotal.toLocaleString()}원` },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card">
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1.5">{s.label}</div>
            <div className="text-display text-2xl font-bold text-zinc-50 tracking-[-0.025em]">{s.value}</div>
          </div>
        ))}
      </section>

      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden shadow-card">
        {payments.length === 0 ? (
          <div className="p-16 text-center text-sm text-zinc-400">결제 내역이 없습니다 (수동 구독 부여는 여기 표시되지 않습니다)</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 border-b border-zinc-700">
                <tr className="text-xs text-zinc-400 uppercase tracking-wider">
                  <th className="text-left px-6 py-4 font-semibold">일시</th>
                  <th className="text-left px-6 py-4 font-semibold">회원</th>
                  <th className="text-right px-6 py-4 font-semibold">금액</th>
                  <th className="text-left px-6 py-4 font-semibold">상태</th>
                  <th className="text-left px-6 py-4 font-semibold">수단</th>
                  <th className="text-left px-6 py-4 font-semibold">주문번호</th>
                  <th className="text-left px-6 py-4 font-semibold">PG 키(TID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {payments.map((p) => {
                  const st = STATUS_LABEL[p.status] || { label: p.status, cls: 'bg-zinc-500/10 text-zinc-400' };
                  return (
                    <tr key={p.id} className="text-zinc-200 hover:bg-zinc-900 transition-colors">
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {getRelativeTime(p.createdAt)}
                        <div className="text-[10px] text-zinc-500">{formatDate(p.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-zinc-50 text-xs font-semibold">{p.user.name || '-'}</div>
                        <div className="text-[11px] text-zinc-400">{p.user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs tabular-nums">{p.amount.toLocaleString()}원</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-400">{p.method || '-'}</td>
                      <td className="px-6 py-4 text-[11px] text-zinc-500 font-mono">{p.orderId}</td>
                      <td className="px-6 py-4 text-[11px] text-zinc-500 font-mono max-w-[160px] truncate">{p.paymentKey || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
