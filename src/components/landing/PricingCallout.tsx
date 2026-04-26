import Link from 'next/link';
import { SUBSCRIPTION_PRICE_KRW, SUBSCRIPTION_DAYS, type SessionUser } from '@/lib/auth';
import { ArrowRight, Check, PlusCircle } from '@/components/ui/Icon';

const INCLUDED = [
  '3대 플랫폼 통합 모니터링',
  '매일 자동 수집되는 신선 데이터',
  'AI 자동 카테고리 분류',
  '바이럴 점수·예상 매출 자동 계산',
  '도매처 / 판매처 바로가기 링크',
  '자동 갱신 없는 안전한 단일 결제',
];

interface Props {
  user: SessionUser | null;
}

export default function PricingCallout({ user }: Props) {
  const ctaHref =
    user?.hasActiveSubscription || user?.role === 'ADMIN'
      ? '/dashboard'
      : user
      ? '/account'
      : '/signup';
  const ctaLabel = user
    ? user.hasActiveSubscription || user.role === 'ADMIN'
      ? '대시보드 가기'
      : '내 정보로 이동'
    : '무료로 시작하기';

  return (
    <div className="relative overflow-hidden bg-zinc-950 border border-zinc-700 rounded-3xl shadow-card">
      {/* subtle accent backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] via-transparent to-sky-500/[0.04]" />
      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-10 lg:gap-14 p-10 sm:p-12 lg:p-16">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.22em] mb-5">
            요금제
          </div>
          <h2 className="text-display text-3xl sm:text-[40px] font-bold text-zinc-50 leading-[1.15] tracking-[-0.025em] mb-5">
            한 가지 플랜,<br className="hidden sm:block" />
            <span className="text-blue-500">자동 갱신 없음</span>
          </h2>
          <p className="text-base text-zinc-400 leading-[1.7] mb-8">
            결제는 한 번. 의도하지 않은 결제 걱정 없이 사용하세요.
          </p>
          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-display text-5xl sm:text-6xl font-bold text-zinc-50 tracking-[-0.04em] tabular-nums">
              {SUBSCRIPTION_PRICE_KRW.toLocaleString('ko-KR')}
            </span>
            <span className="text-2xl text-zinc-400 font-medium">원</span>
            <span className="text-sm text-zinc-400">/ {SUBSCRIPTION_DAYS}일</span>
          </div>
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center gap-1.5 px-7 h-12 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/25"
          >
            <PlusCircle size={15} strokeWidth={2.25} />
            {ctaLabel}
          </Link>
        </div>

        <div className="bg-background/40 backdrop-blur-sm border border-zinc-700 rounded-2xl p-7">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.22em] mb-5">
            포함된 것
          </div>
          <ul className="space-y-3.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-zinc-200 leading-[1.6]">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 mt-0.5 shrink-0 ring-1 ring-blue-200/60 dark:ring-blue-500/20">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="mt-7 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:gap-2 transition-all"
          >
            요금제 자세히 보기
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
