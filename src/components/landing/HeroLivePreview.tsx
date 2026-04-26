import Link from 'next/link';
import { getTopProducts } from '@/lib/landing-data';
import { formatCount, formatKRW, estimateRevenue, PLATFORM_NAMES } from '@/lib/utils';
import { TrendingUp, ArrowRight, Eye } from '@/components/ui/Icon';
import SafeThumbnail from '@/components/ui/SafeThumbnail';
import type { Platform } from '@prisma/client';

const PLATFORM_DOT: Record<Platform, string> = {
  YOUTUBE: 'bg-red-500',
  TIKTOK: 'bg-teal-500',
  INSTAGRAM: 'bg-fuchsia-500',
};

const PLATFORM_PATH: Record<Platform, string> = {
  YOUTUBE: 'youtube',
  TIKTOK: 'tiktok',
  INSTAGRAM: 'instagram',
};

/**
 * Hero side panel — shows the live #1 ranked product.
 *
 * Design:
 *   - Image area (3/4 of card height) with always-visible gradient backdrop;
 *     thumbnail overlays it. If thumbnail fails, the gradient + platform logo
 *     show — never an empty white box.
 *   - Title + revenue/views in info panel BELOW image (not over it) so the
 *     card stays informative even when image fails.
 *   - Subtle float animation + entrance fade-up.
 *   - Hover: card un-tilts, scale up subtly, "상세 보기" hint slides up.
 */
export default async function HeroLivePreview() {
  const products = await getTopProducts(1);
  const top = products[0];

  // Empty state — show a designed placeholder (not just text)
  if (!top) {
    return (
      <div className="hidden lg:flex aspect-[4/5] rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-700 shadow-2xl items-center justify-center">
        <div className="text-center px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 mb-4 ring-1 ring-blue-500/20">
            <TrendingUp size={28} />
          </div>
          <p className="text-sm font-semibold text-zinc-300">곧 첫 데이터가 수집됩니다</p>
          <p className="text-xs text-zinc-500 mt-1">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  const revenue = estimateRevenue(top.viewCount, top.likeCount, top.platform);

  return (
    <div className="relative animate-fade-up">
      {/* Soft glow behind card */}
      <div className="absolute -inset-8 bg-gradient-to-tr from-blue-500/25 via-sky-500/15 to-transparent blur-3xl pointer-events-none" />

      {/* Outer wrapper — float animation only (so tilt + hover compose cleanly) */}
      <div className="relative animate-float-slow">

        {/* LIVE pill (top-left, anchored to card) */}
        <div className="absolute -top-3 left-6 z-20 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950 border border-zinc-700 shadow-xl text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          LIVE
        </div>

        {/* Preview card — slight tilt, un-tilts on hover */}
        <Link
          href={`/dashboard/${PLATFORM_PATH[top.platform]}/${top.id}`}
          className="group relative block bg-zinc-950 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden transform lg:-rotate-[1.5deg] hover:rotate-0 hover:scale-[1.015] transition-all duration-500 ease-out"
        >
          {/* Image area */}
          <div className="relative aspect-[9/11] bg-zinc-900 overflow-hidden">
            <SafeThumbnail
              src={top.thumbnailUrl}
              alt={top.title || ''}
              platform={top.platform}
              fallbackIconSize={88}
              eager
            />

            {/* Top-left platform pill — over image */}
            <div className="absolute top-5 left-5 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/80 backdrop-blur-md text-[11px] font-semibold text-zinc-50 ring-1 ring-white/10">
              <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[top.platform]}`} />
              {PLATFORM_NAMES[top.platform].split(' ')[0]}
            </div>

            {/* Top-right rank badge — animates in on mount */}
            <div className="absolute top-5 right-5 z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 shadow-xl ring-2 ring-amber-200/40 animate-badge-pop">
              <span className="text-2xl font-black">1</span>
            </div>

            {/* Bottom gradient (subtle, only over image) */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-zinc-950/40 to-transparent pointer-events-none" />
          </div>

          {/* Info panel — always visible regardless of image */}
          <div className="relative p-6 space-y-5">
            {/* Title block */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-blue-400 font-semibold mb-2">
                지금 1등 상품
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-50 line-clamp-2 leading-snug tracking-tight min-h-[2.6em]">
                {top.title || '무제'}
              </h3>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-700">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 font-semibold mb-1.5">
                  예상 매출
                </div>
                <div className="text-display text-2xl font-bold text-blue-400 tabular-nums tracking-[-0.02em]">
                  {formatKRW(revenue)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 font-semibold mb-1.5">
                  조회수
                </div>
                <div className="flex items-center gap-1.5 text-display text-2xl font-bold text-zinc-50 tabular-nums tracking-[-0.02em]">
                  <Eye size={14} className="text-zinc-400" strokeWidth={2.25} />
                  {formatCount(top.viewCount)}
                </div>
              </div>
            </div>
          </div>

          {/* Hover hint — slides up from bottom */}
          <div className="absolute inset-x-0 bottom-0 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            상세 정보 보기 <ArrowRight size={14} />
          </div>
        </Link>
      </div>
    </div>
  );
}
