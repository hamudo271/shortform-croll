import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ArrowRight, PlusCircle } from '@/components/ui/Icon';
import HeroStats from '@/components/landing/HeroStats';
import HeroLivePreview from '@/components/landing/HeroLivePreview';
import TopProductsPreview from '@/components/landing/TopProductsPreview';
import HowItWorks from '@/components/landing/HowItWorks';
import PlatformShowcase from '@/components/landing/PlatformShowcase';
import ScenarioCards from '@/components/landing/ScenarioCards';
import PricingCallout from '@/components/landing/PricingCallout';
import FAQTeaser from '@/components/landing/FAQTeaser';

export const revalidate = 3600;

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="text-center mb-14 sm:mb-16">
      <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.22em] mb-4">
        {eyebrow}
      </div>
      <h2 className="text-display text-[28px] sm:text-4xl md:text-[44px] font-bold text-zinc-50 leading-[1.15] tracking-[-0.025em] max-w-3xl mx-auto">
        {title}
      </h2>
      {sub && (
        <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-xl mx-auto leading-[1.7]">
          {sub}
        </p>
      )}
    </div>
  );
}

export default async function LandingPage() {
  const user = await getCurrentUser();

  const primaryHref =
    user?.hasActiveSubscription || user?.role === 'ADMIN'
      ? '/dashboard'
      : user
      ? '/account'
      : '/signup';
  const primaryLabel = user
    ? user.hasActiveSubscription || user.role === 'ADMIN'
      ? '대시보드 가기'
      : '내 정보로 이동'
    : '7일 무료 체험 시작';

  return (
    <div className="min-h-screen">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-12 sm:py-16 space-y-24 sm:space-y-32">
        {/* 1. Hero — split layout: copy on left, live preview card on right */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] items-center gap-10 lg:gap-16 pt-4">
          {/* Left: copy + CTAs */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-7 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/20 rounded-full uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              유통업자 · 인스타 셀러 전용
            </div>
            <h1 className="text-display text-[40px] sm:text-6xl lg:text-7xl font-bold text-zinc-50 leading-[1.02] tracking-[-0.04em] mb-6">
              잘 팔리는 상품,<br />
              <span className="bg-gradient-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">
                먼저 발견
              </span>하세요.
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-[1.7] mb-10">
              유튜브 쇼츠 · 틱톡 · 인스타 릴스에서 매일 자동 수집한 인기 상품을
              순위 · 예상 매출 · 도매처 링크까지 정리해 보여드립니다.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center justify-center gap-1.5 px-7 h-12 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/25"
              >
                <PlusCircle size={15} strokeWidth={2.25} />
                {primaryLabel}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-1.5 px-7 h-12 text-sm font-semibold text-zinc-100 hover:text-zinc-50 hover:bg-zinc-900 rounded-xl transition-colors"
              >
                요금제 보기
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Right: tilted live preview card */}
          <div className="lg:pl-4">
            <HeroLivePreview />
          </div>
        </section>

        {/* Stats strip — full width below hero */}
        <section className="-mt-8">
          <HeroStats />
        </section>

        {/* 2. Top 3 Real Data Preview */}
        <section>
          <SectionHeader
            eyebrow="실시간 인기"
            title={<>지금 <span className="text-blue-500">1·2·3등</span> 상품</>}
            sub="조회수 기준 Top 3. 클릭하면 상세 정보·도매처·판매처 링크를 볼 수 있습니다."
          />
          <TopProductsPreview />
        </section>

        {/* 3. How It Works */}
        <section>
          <SectionHeader
            eyebrow="작동 원리"
            title={<>3단계 <span className="text-blue-500">자동화</span>로 끝</>}
            sub="수집 · 분류 · 매출 계산까지 자동. 결과만 받으시면 됩니다."
          />
          <HowItWorks />
        </section>

        {/* 4. Platform Showcase */}
        <section>
          <SectionHeader
            eyebrow="3대 플랫폼"
            title={<><span className="text-blue-500">한 화면</span>에 모았습니다</>}
            sub="플랫폼별로 따로 검색할 필요 없이 한 곳에서 다 봅니다."
          />
          <PlatformShowcase />
        </section>

        {/* 5. Scenarios */}
        <section>
          <SectionHeader
            eyebrow="활용 사례"
            title={<>유통·셀러는 <span className="text-blue-500">이렇게 씁니다</span></>}
            sub="실제 사용자가 매일 반복하는 워크플로우."
          />
          <ScenarioCards />
        </section>

        {/* 6. Pricing */}
        <section>
          <PricingCallout user={user} />
        </section>

        {/* 7. FAQ */}
        <section>
          <SectionHeader
            eyebrow="FAQ"
            title="자주 묻는 질문"
          />
          <FAQTeaser />
        </section>

        {/* 8. Final CTA — refined: 더 minimal한 톤 */}
        <section>
          <div className="relative overflow-hidden bg-zinc-950 border border-zinc-700 rounded-3xl p-12 sm:p-20 text-center shadow-card">
            {/* subtle gradient backdrop */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-sky-500/10" />
            <div className="relative">
              <h2 className="text-display text-3xl sm:text-5xl md:text-[56px] font-bold text-zinc-50 leading-[1.1] tracking-[-0.03em] mb-5">
                오늘 뜨는 상품,<br className="sm:hidden" /> <span className="text-blue-500">지금 확인하세요</span>
              </h2>
              <p className="text-base sm:text-lg text-zinc-400 mb-10 max-w-md mx-auto leading-relaxed">
                카드 등록 없이 7일 무료 체험. 마음에 들면 그때 결제하세요.
              </p>
              <Link
                href={primaryHref}
                className="inline-flex items-center justify-center gap-1.5 px-8 h-12 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/30"
              >
                <PlusCircle size={15} strokeWidth={2.25} />
                {primaryLabel}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
