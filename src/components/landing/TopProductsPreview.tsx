import Link from 'next/link';
import { getTopProducts } from '@/lib/landing-data';
import {
  formatCount,
  formatKRW,
  estimateRevenue,
  CATEGORY_NAMES,
  PLATFORM_NAMES,
} from '@/lib/utils';
import { ArrowRight, Eye, Heart, Lock, TrendingUp } from '@/components/ui/Icon';
import type { Platform } from '@prisma/client';

const PLATFORM_DOT: Record<Platform, string> = {
  YOUTUBE: 'bg-red-500',
  TIKTOK: 'bg-teal-500',
  INSTAGRAM: 'bg-fuchsia-500',
};

const PLATFORM_BADGE: Record<Platform, string> = {
  YOUTUBE: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  TIKTOK: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  INSTAGRAM: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-400',
};

const RANK_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950',
  2: 'bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-900',
  3: 'bg-gradient-to-br from-orange-300 to-amber-600 text-orange-950',
};

function PlatformPath(p: Platform): string {
  return p === 'YOUTUBE' ? 'youtube' : p === 'TIKTOK' ? 'tiktok' : 'instagram';
}

export default async function TopProductsPreview() {
  const products = await getTopProducts(8);
  const top3 = products.slice(0, 3);
  const blurred = products.slice(3); // 4-8등

  if (top3.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl py-16 px-6 text-center shadow-card">
        <p className="text-display text-xl font-bold text-zinc-50 mb-2">
          첫 데이터 수집을 곧 시작합니다
        </p>
        <p className="text-sm text-zinc-400">
          가입 후 대시보드에서 실시간 인기 상품을 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top 3 — fully visible, clickable */}
      {top3.map((p, i) => {
        const rank = i + 1;
        const revenue = estimateRevenue(p.viewCount, p.likeCount, p.platform);
        return (
          <Link
            key={p.id}
            href={`/dashboard/${PlatformPath(p.platform)}/${p.id}`}
            className="group flex items-center gap-4 sm:gap-5 bg-zinc-950 border border-zinc-700 hover:border-blue-500 rounded-2xl p-4 sm:p-5 shadow-card hover:shadow-card-hover transition-all"
          >
            <div className={`shrink-0 inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-lg sm:text-xl font-bold ${RANK_STYLES[rank]}`}>
              {rank}
            </div>

            <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden bg-zinc-800 relative">
              {p.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${PLATFORM_BADGE[p.platform]}`}>
                  <span className={`w-1 h-1 rounded-full ${PLATFORM_DOT[p.platform]}`} />
                  {PLATFORM_NAMES[p.platform].split(' ')[0]}
                </span>
                {p.category && (
                  <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                    {CATEGORY_NAMES[p.category]}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-zinc-50 line-clamp-2 leading-snug tracking-tight mb-1.5">
                {p.title || '무제'}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <Eye size={11} className="text-zinc-500" />
                  <span className="font-medium tabular-nums text-zinc-300">{formatCount(p.viewCount)}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart size={11} className="text-zinc-500" />
                  <span className="font-medium tabular-nums text-zinc-300">{formatCount(p.likeCount)}</span>
                </span>
              </div>
            </div>

            <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">예상 매출</div>
              <div className="text-display text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums tracking-[-0.02em]">
                {formatKRW(revenue)}
              </div>
            </div>
          </Link>
        );
      })}

      {/* 4-8 — blurred paywall */}
      {blurred.length > 0 && (
        <div className="relative">
          <div className="space-y-3 select-none pointer-events-none" aria-hidden="true">
            {blurred.slice(0, 3).map((p, i) => {
              const rank = i + 4;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 sm:gap-5 bg-zinc-950 border border-zinc-700 rounded-2xl p-4 sm:p-5 shadow-card opacity-60"
                  style={{ filter: 'blur(3px)' }}
                >
                  <div className="shrink-0 inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-lg sm:text-xl font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {rank}
                  </div>
                  <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden bg-zinc-800" />
                  <div className="min-w-0 flex-1">
                    <div className="h-3 w-24 bg-zinc-800 rounded mb-2" />
                    <div className="h-4 w-3/4 bg-zinc-800 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-zinc-800 rounded" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paywall overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background via-background/80 to-transparent">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 h-12 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-lg"
            >
              <Lock size={14} />
              전체 순위 보려면 가입
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Trust line under list */}
      <p className="text-center text-xs text-zinc-500 pt-3 flex items-center justify-center gap-1.5">
        <TrendingUp size={11} className="text-blue-500" />
        예상 매출은 조회수·좋아요·플랫폼 기반 추정치 (정확한 매출과 다를 수 있음)
      </p>
    </div>
  );
}
