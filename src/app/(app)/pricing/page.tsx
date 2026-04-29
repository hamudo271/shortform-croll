import Link from 'next/link';
import type { Metadata } from 'next';
import {
  SUBSCRIPTION_DAYS,
  SUBSCRIPTION_PRICE_KRW,
  SUBSCRIPTION_ORIGINAL_PRICE_KRW,
  TRIAL_DAYS,
  getCurrentUser,
} from '@/lib/auth';
import { ArrowRight, Check, ChevronDown, PlusCircle } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: '요금제',
  description: `${TRIAL_DAYS}일 무료 체험 후 ${SUBSCRIPTION_DAYS}일 ${SUBSCRIPTION_PRICE_KRW.toLocaleString('ko-KR')}원 (정가 ${SUBSCRIPTION_ORIGINAL_PRICE_KRW.toLocaleString('ko-KR')}원 할인). 자동 갱신 없음.`,
};

const INCLUDED = [
  '유튜브 쇼츠 · 틱톡 · 인스타 릴스 통합 모니터링',
  '매일 자동 수집되는 신선 데이터',
  'AI 자동 카테고리 분류 (7개 카테고리)',
  '바이럴 점수 · 조회수 급상승 추적',
  '플랫폼 · 카테고리 · 연령 · 기간 · 키워드 필터링',
  'Top 바이럴 영상 랭킹',
  '이메일 문의 지원',
];

const FAQS = [
  { q: '데이터는 얼마나 신선한가요?', a: '매일 새벽 자동 수집됩니다. 실시간은 아니지만 최근 24시간 이내의 트렌드를 매일 새 데이터로 받아보실 수 있습니다.' },
  { q: '무료 체험은 어떻게 시작하나요?', a: '회원가입만 하시면 자동으로 7일 무료 체험이 시작됩니다. 카드 등록이나 결제 정보 입력은 필요 없습니다. 체험 기간 중 모든 기능을 무제한으로 사용해보실 수 있습니다.' },
  { q: '체험이 끝나면 자동 결제되나요?', a: '아니요. 자동 결제는 절대 없습니다. 7일 후 체험이 만료되면 이용이 중지될 뿐, 결제는 본인이 입금하실 때만 진행됩니다.' },
  { q: '환불이 되나요?', a: '결제 후 7일 이내, 사용 이력이 없을 경우 100% 환불해 드립니다. 사용을 시작하신 후에는 일할 환불이 어렵습니다.' },
  { q: '자동 갱신되나요?', a: '자동 갱신은 없습니다. 28일 후 만료되며, 연장을 원하시면 재입금하시면 됩니다.' },
  { q: '데이터를 다운로드할 수 있나요?', a: '현재는 화면에서 확인하는 형태만 제공합니다. CSV 내보내기는 로드맵에 있습니다.' },
  { q: '계정을 팀원과 공유해도 되나요?', a: '1계정 1인 사용을 원칙으로 합니다. 팀 플랜은 추후 제공 예정입니다.' },
  { q: '회원가입만 하고 결제는 나중에 할 수 있나요?', a: '네, 가입은 무료입니다. 결제 전까지는 대시보드만 잠금 상태로 유지됩니다.' },
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const ctaHref = user ? '/account' : '/signup';
  const ctaLabel = user ? '내 정보로 이동' : `${TRIAL_DAYS}일 무료 체험 시작`;
  const discountPercent = Math.round(
    (1 - SUBSCRIPTION_PRICE_KRW / SUBSCRIPTION_ORIGINAL_PRICE_KRW) * 100,
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-10 sm:py-14 space-y-16">
        {/* Hero */}
        <section className="text-center">
          <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em] mb-4">
            요금제
          </div>
          <h1 className="text-display text-3xl sm:text-5xl font-bold text-zinc-50 leading-tight tracking-[-0.025em] mb-4">
            <span className="text-blue-500">{TRIAL_DAYS}일 무료</span> 체험 후, 한 가지 플랜
          </h1>
          <p className="text-base sm:text-lg text-zinc-400">
            카드 등록 없이 무료로 써보고, 마음에 들면 결제하세요. 자동 갱신 없음.
          </p>
        </section>

        {/* Pricing card */}
        <section>
          <div className="max-w-md mx-auto bg-zinc-950 border border-zinc-700 rounded-3xl p-8 sm:p-10 shadow-card">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full uppercase tracking-[0.16em]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              런칭 특가 · {discountPercent}% 할인
            </div>
            <div className="text-base text-zinc-500 line-through tabular-nums mb-1">
              {SUBSCRIPTION_ORIGINAL_PRICE_KRW.toLocaleString('ko-KR')}원
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-display text-5xl sm:text-6xl font-bold text-zinc-50 tracking-[-0.04em]">
                {SUBSCRIPTION_PRICE_KRW.toLocaleString('ko-KR')}
              </span>
              <span className="text-2xl text-zinc-400 font-medium">원</span>
            </div>
            <p className="text-sm text-zinc-400 mb-8">
              {SUBSCRIPTION_DAYS}일 이용 · 자동 갱신 없음 · 가입 즉시 {TRIAL_DAYS}일 무료
            </p>

            <ul className="space-y-3 mb-8">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-200 leading-relaxed">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 mt-0.5 shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href={ctaHref}
              className="inline-flex w-full items-center justify-center gap-1.5 h-12 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-sm"
            >
              <PlusCircle size={15} strokeWidth={2.25} />
              {ctaLabel}
            </Link>
          </div>
        </section>

        {/* Payment process */}
        <section>
          <div className="text-center mb-10">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em] mb-4">
              결제 방식
            </div>
            <h2 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 tracking-[-0.02em] mb-3">
              현재는 <span className="text-blue-500">수동 승인</span> 방식 💳
            </h2>
            <p className="text-base text-zinc-400 max-w-2xl mx-auto">
              카드 결제(PG)는 준비 중입니다. 그동안은 계좌 입금 후 관리자가 직접 활성화해 드립니다.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { n: '1', title: '회원가입', body: `가입 즉시 ${TRIAL_DAYS}일 무료 체험 자동 시작` },
              { n: '2', title: '체험 후 입금', body: `만족하시면 ${SUBSCRIPTION_PRICE_KRW.toLocaleString('ko-KR')}원 계좌 입금` },
              { n: '3', title: '관리자 활성화', body: '입금 확인 후 24시간 이내 활성화' },
              { n: '4', title: `${SUBSCRIPTION_DAYS}일간 이용`, body: '모든 기능 무제한 이용' },
            ].map((step) => (
              <div key={step.n} className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white text-sm font-bold mb-4 shadow-sm">
                  {step.n}
                </div>
                <div className="text-base font-semibold text-zinc-50 mb-1.5 tracking-tight">{step.title}</div>
                <div className="text-sm text-zinc-400 leading-relaxed">{step.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <div className="text-center mb-10">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-[0.18em] mb-4">
              FAQ
            </div>
            <h2 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 tracking-[-0.02em]">
              자주 묻는 <span className="text-amber-500">질문</span> 💬
            </h2>
          </div>
          <div className="max-w-3xl mx-auto bg-zinc-950 border border-zinc-700 rounded-2xl divide-y divide-zinc-700 shadow-card">
            {FAQS.map((f, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-zinc-900 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                  <span className="text-base font-semibold text-zinc-50 pr-4 tracking-tight">{f.q}</span>
                  <ChevronDown className="text-zinc-400 shrink-0 transition-transform group-open:rotate-180" size={18} />
                </summary>
                <div className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-500/5 dark:to-sky-500/5 border border-blue-200 dark:border-blue-500/20 rounded-3xl p-8 sm:p-12 text-center">
            <h2 className="text-display text-3xl sm:text-4xl font-bold text-zinc-50 tracking-[-0.025em] mb-4">
              지금 <span className="text-blue-500">시작</span>하세요 🚀
            </h2>
            <p className="text-base sm:text-lg text-zinc-400 mb-8 max-w-md mx-auto">
              가입은 무료입니다. 결제 안내는 가입 직후 안내됩니다.
            </p>
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-1.5 px-7 h-12 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-sm"
            >
              <PlusCircle size={15} strokeWidth={2.25} />
              {ctaLabel}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
