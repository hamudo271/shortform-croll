import Link from 'next/link';
import { getCurrentUser, SUBSCRIPTION_PRICE_KRW, SUBSCRIPTION_DAYS } from '@/lib/auth';
import {
  PlusCircle,
  TrendingUp,
  Layers,
  Eye,
  Search,
  ArrowRight,
} from '@/components/ui/Icon';

const FEATURE_CARDS = [
  {
    href: '/dashboard/youtube',
    title: '유튜브 쇼츠',
    accent: '바이럴',
    body: '유튜브 쇼츠에서 매일 자동 수집되는\n인기 상품 영상을 한눈에',
    Icon: TrendingUp,
    iconBg: 'bg-gradient-to-br from-red-400 to-red-600',
    cta: 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600',
    ctaLabel: '쇼츠 보기',
  },
  {
    href: '/dashboard/tiktok',
    title: '틱톡',
    accent: '바이럴',
    body: '한국 틱톡 인기 영상 중\n상품·리뷰·추천 콘텐츠만 필터링',
    Icon: TrendingUp,
    iconBg: 'bg-gradient-to-br from-teal-400 to-emerald-600',
    cta: 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600',
    ctaLabel: '쇼츠 보기',
  },
  {
    href: '/dashboard/instagram',
    title: '인스타 릴스',
    accent: '바이럴',
    body: '인스타 공식 브랜드 계정과\n인기 셀러 릴스 모음',
    Icon: TrendingUp,
    iconBg: 'bg-gradient-to-br from-fuchsia-400 to-purple-600',
    cta: 'bg-gradient-to-r from-fuchsia-500 to-purple-500 hover:from-fuchsia-600 hover:to-purple-600',
    ctaLabel: '쇼츠 보기',
  },
  {
    href: '/pricing',
    title: '요금제',
    accent: '안내',
    body: '28일 100,000원\n자동 갱신 없는 단일 플랜',
    Icon: Eye,
    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-600',
    cta: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
    ctaLabel: '자세히 보기',
  },
];

const SCENARIOS = [
  { tag: '뷰티', title: '올리브영 신상 → 도매처 컨택', body: 'BEAUTY 카테고리 급상승 영상에서 제품을 발견하고 도매처를 찾아 빠르게 입고합니다.', tone: 'pink' },
  { tag: '라이프', title: '다이소 꿀템 → 알리 직구', body: 'LIFESTYLE 인기 아이템을 보고 알리바바·1688에서 동일 품목을 소싱해 마진을 확보합니다.', tone: 'amber' },
  { tag: '라이브', title: '다음 라이브 상품 큐레이션', body: '오늘의 Top 바이럴에서 라이브에 올릴 3–5개 상품을 골라 매출을 끌어올립니다.', tone: 'sky' },
];

const SCENARIO_TONE: Record<string, string> = {
  pink: 'bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
};

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-10 sm:py-14">
        {/* Hero */}
        <section className="text-center mb-14">
          <h1 className="text-display text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-50 leading-tight tracking-[-0.025em] mb-4">
            대행사 없이도 <span className="text-emerald-500">손쉽게</span> 트렌드를 잡으세요! 🚀
          </h1>
          <p className="text-base sm:text-lg text-zinc-400">
            유통·셀러를 위한 쇼츠 트렌드 대시보드, 바이럴 쇼츠.
          </p>
        </section>

        {/* Feature cards (셀프마케팅 메인 4-카드 패턴) */}
        <section className="mb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.title}
                className="group relative bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${card.iconBg} text-white mb-6 shadow-sm`}>
                  <card.Icon size={28} strokeWidth={2.25} />
                </div>
                <h3 className="text-display text-xl font-bold text-zinc-50 mb-3 tracking-[-0.02em]">
                  {card.title} <span className="text-emerald-500">{card.accent}</span>
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-6 whitespace-pre-line min-h-[3em]">
                  {card.body}
                </p>
                <Link
                  href={card.href}
                  className={`inline-flex items-center justify-center gap-1.5 w-full h-11 text-sm font-semibold text-white rounded-xl transition-all shadow-sm ${card.cta}`}
                >
                  <PlusCircle size={14} strokeWidth={2.25} />
                  {card.ctaLabel}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Scenarios */}
        <section className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 leading-tight tracking-[-0.02em] mb-3">
              <span className="text-emerald-500">실제</span> 활용 사례 📈
            </h2>
            <p className="text-base text-zinc-400">바이럴 쇼츠로 매출을 키운 분들의 실사용 시나리오</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SCENARIOS.map((s) => (
              <div key={s.title} className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mb-4 ${SCENARIO_TONE[s.tone]}`}>
                  {s.tag}
                </span>
                <h3 className="text-display text-lg font-bold text-zinc-50 mb-3 tracking-[-0.015em] leading-snug">
                  {s.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mb-10">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-3xl p-8 sm:p-12 text-center">
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.18em] mb-4">
              요금제
            </div>
            <h2 className="text-display text-3xl sm:text-4xl font-bold text-zinc-50 leading-tight tracking-[-0.025em] mb-3">
              지금 시작하세요
            </h2>
            <p className="text-base sm:text-lg text-zinc-400 mb-8 max-w-md mx-auto">
              <span className="text-zinc-50 font-bold">{SUBSCRIPTION_PRICE_KRW.toLocaleString('ko-KR')}원</span> / {SUBSCRIPTION_DAYS}일 · 자동 갱신 없음
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={user?.hasActiveSubscription || user?.role === 'ADMIN' ? '/dashboard' : user ? '/account' : '/signup'}
                className="inline-flex items-center justify-center gap-1.5 px-6 h-12 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl transition-all shadow-sm"
              >
                <PlusCircle size={15} strokeWidth={2.25} />
                {user ? (user.hasActiveSubscription || user.role === 'ADMIN' ? '대시보드 가기' : '내 정보로 이동') : '무료로 시작하기'}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-1.5 px-6 h-12 text-sm font-semibold text-zinc-100 border border-zinc-700 hover:bg-zinc-900 rounded-xl transition-colors"
              >
                요금제 자세히
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
