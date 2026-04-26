import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, SUBSCRIPTION_PRICE_KRW, SUBSCRIPTION_DAYS } from '@/lib/auth';
import PageHeader from '@/components/app/PageHeader';
import { ArrowRight, PlusCircle } from '@/components/ui/Icon';

function formatKRW(amount: number) {
  return amount.toLocaleString('ko-KR') + '원';
}

function formatDate(d: Date | null | undefined) {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function daysUntil(d: Date | null | undefined) {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const remaining = daysUntil(user.subscriptionEndAt);

  return (
    <div className="max-w-[900px] mx-auto px-6 sm:px-10 py-10 space-y-10">
      <PageHeader title="정보" accent="내" emoji="👤" />

      {/* Subscription */}
      <section>
        <h2 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em] mb-4">구독 상태</h2>

        {user.hasActiveSubscription ? (
          <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-7 sm:p-8 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                활성
              </span>
              <span className="text-sm text-zinc-400">{remaining}일 남음</span>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-7">
              <div>
                <div className="text-xs text-zinc-400 mb-1.5 font-semibold">만료일</div>
                <div className="text-display text-2xl text-zinc-50 font-bold tracking-[-0.02em]">{formatDate(user.subscriptionEndAt)}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1.5 font-semibold">상품</div>
                <div className="text-display text-2xl text-zinc-50 font-bold tracking-[-0.02em]">
                  {SUBSCRIPTION_DAYS}일 · {formatKRW(SUBSCRIPTION_PRICE_KRW)}
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-5 h-11 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-sm"
            >
              <PlusCircle size={14} strokeWidth={2.25} />
              대시보드로 이동
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-7 sm:p-8 shadow-card">
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {user.subscriptionStatus === 'EXPIRED' ? '만료됨' : user.subscriptionStatus === 'CANCELED' ? '취소됨' : '미활성화'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-display text-4xl sm:text-5xl font-bold text-zinc-50 tracking-[-0.04em]">
                  {SUBSCRIPTION_PRICE_KRW.toLocaleString('ko-KR')}
                </span>
                <span className="text-xl text-zinc-400 font-medium">원</span>
                <span className="text-sm text-zinc-400">/ {SUBSCRIPTION_DAYS}일</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                바이럴 쇼츠 데이터를 보려면 구독이 필요합니다.
                아래 안내에 따라 입금 후 관리자가 활성화해 드립니다.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-500/5 dark:to-sky-500/5 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-7 sm:p-8 shadow-card">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em] mb-5">입금 안내</div>
              <div className="grid grid-cols-[80px_1fr] gap-y-3 text-sm">
                <div className="text-zinc-400">계좌</div>
                <div className="text-zinc-50 font-semibold">관리자 문의</div>
                <div className="text-zinc-400">입금자명</div>
                <div className="text-zinc-50 font-semibold">{user.name || user.email}</div>
                <div className="text-zinc-400">금액</div>
                <div className="text-zinc-50 font-semibold">{formatKRW(SUBSCRIPTION_PRICE_KRW)}</div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pt-5 mt-5 border-t border-blue-200 dark:border-blue-500/20">
                입금 확인 후 관리자가 구독을 {SUBSCRIPTION_DAYS}일간 활성화합니다.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Account info */}
      <section>
        <h2 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em] mb-4">계정 정보</h2>
        <div className="bg-zinc-950 border border-zinc-700 rounded-2xl divide-y divide-zinc-700 shadow-card">
          {[
            { label: '이메일', value: user.email },
            { label: '이름', value: user.name || '-' },
            { label: '권한', value: user.role === 'ADMIN' ? '관리자' : '일반 회원' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-7 py-5 text-sm">
              <span className="text-zinc-400 font-medium">{row.label}</span>
              <span className="text-zinc-50 font-semibold">{row.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
