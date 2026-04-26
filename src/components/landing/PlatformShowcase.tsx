import Link from 'next/link';
import { getLandingStats } from '@/lib/landing-data';
import { ArrowRight, YouTubeLogo, TikTokLogo, InstagramLogo } from '@/components/ui/Icon';
import type { Platform } from '@prisma/client';

interface CardConfig {
  platform: Platform;
  href: string;
  title: string;
  Logo: typeof YouTubeLogo;
  iconBg: string;
  iconColor: string;
}

const CARDS: CardConfig[] = [
  {
    platform: 'TIKTOK',
    href: '/dashboard/tiktok',
    title: '틱톡',
    Logo: TikTokLogo,
    iconBg: 'bg-zinc-900 ring-1 ring-zinc-700',
    iconColor: 'text-teal-400',
  },
  {
    platform: 'INSTAGRAM',
    href: '/dashboard/instagram',
    title: '인스타 릴스',
    Logo: InstagramLogo,
    iconBg: 'bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600',
    iconColor: 'text-white',
  },
  {
    platform: 'YOUTUBE',
    href: '/dashboard/youtube',
    title: '유튜브 쇼츠',
    Logo: YouTubeLogo,
    iconBg: 'bg-zinc-900 ring-1 ring-zinc-700',
    iconColor: 'text-red-500',
  },
];

export default async function PlatformShowcase() {
  const stats = await getLandingStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {CARDS.map((c) => {
        const count = stats.platformCounts[c.platform] ?? 0;
        return (
          <Link
            key={c.platform}
            href={c.href}
            className="group bg-zinc-950 border border-zinc-700 rounded-2xl p-7 shadow-card hover:shadow-card-hover hover:border-blue-500/40 hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
          >
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${c.iconBg} ${c.iconColor} mb-6`}>
              <c.Logo size={28} />
            </div>
            <h3 className="text-display text-lg font-bold text-zinc-50 mb-3 tracking-[-0.015em]">
              {c.title}
            </h3>
            <div className="flex items-baseline gap-2 mb-7">
              <span className="text-display text-3xl font-bold text-zinc-50 tabular-nums tracking-[-0.025em]">
                {count.toLocaleString('ko-KR')}
              </span>
              <span className="text-sm text-zinc-400">개 영상 수집됨</span>
            </div>
            <div className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-400 group-hover:gap-2 transition-all">
              인기 상품 보기
              <ArrowRight size={14} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
