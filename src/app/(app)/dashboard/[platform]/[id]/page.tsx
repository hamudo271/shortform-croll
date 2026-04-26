import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import {
  formatCount,
  formatKRW,
  estimateRevenue,
  getDownloaderUrl,
  getWholesalerSearchUrl,
  getNaverShoppingSearchUrl,
  PLATFORM_NAMES,
  CATEGORY_NAMES,
} from '@/lib/utils';
import {
  ChevronRight,
  ExternalLink,
  Eye,
  Heart,
  Play,
  TrendingUp,
} from '@/components/ui/Icon';
import SafeThumbnail from '@/components/ui/SafeThumbnail';
import { Platform } from '@prisma/client';

const PLATFORM_FROM_PARAM: Record<string, Platform> = {
  youtube: 'YOUTUBE',
  tiktok: 'TIKTOK',
  instagram: 'INSTAGRAM',
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ platform: string; id: string }>;
}) {
  const { platform: platformParam, id } = await params;
  const platform = PLATFORM_FROM_PARAM[platformParam];
  if (!platform) notFound();

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.platform !== platform) notFound();

  const viewCount = Number(video.viewCount);
  const likeCount = Number(video.likeCount);
  const commentCount = Number(video.commentCount);
  const revenue = estimateRevenue(viewCount, likeCount, video.platform);
  const engagement = viewCount > 0 ? ((likeCount / viewCount) * 100).toFixed(1) : '0';

  const downloadUrl = getDownloaderUrl(video.videoUrl, video.platform);
  const wholesalerUrl = getWholesalerSearchUrl(video.title);
  const sellerUrl = getNaverShoppingSearchUrl(video.title);

  const platformName = PLATFORM_NAMES[video.platform];
  const platformPath = platformParam;

  return (
    <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-10">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-zinc-400 mb-8" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:text-zinc-50 transition-colors">대시보드</Link>
        <ChevronRight size={14} className="text-zinc-500" />
        <Link href={`/dashboard/${platformPath}`} className="hover:text-zinc-50 transition-colors">
          {platformName}
        </Link>
        <ChevronRight size={14} className="text-zinc-500" />
        <span className="text-zinc-50 truncate max-w-[200px]">상품 상세</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 lg:gap-12">
        {/* Left: thumbnail + play */}
        <div className="space-y-4">
          <div className="relative aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-700 shadow-card">
            <SafeThumbnail
              src={video.thumbnailUrl}
              alt={video.title}
              platform={video.platform}
              fallbackIconSize={88}
              eager
            />
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 hover:bg-zinc-950/30 transition-colors group"
              aria-label="원본 영상 재생"
            >
              <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white group-hover:scale-105 transition-transform shadow-2xl">
                <Play size={28} />
              </span>
            </a>
          </div>

          {/* Estimated revenue (mobile-prominent) */}
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-500/5 dark:to-sky-500/5 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5 shadow-card">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-blue-700 dark:text-blue-400 mb-2">
              예상 매출
            </div>
            <div className="text-display text-3xl sm:text-4xl font-bold text-zinc-50 tracking-[-0.025em]">
              {formatKRW(revenue)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              조회수·좋아요·플랫폼 기반 추정치 (정확한 매출과 다를 수 있음)
            </p>
          </div>
        </div>

        {/* Right: info + actions */}
        <div className="space-y-8">
          {/* Title block */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                video.platform === 'TIKTOK' ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30'
                : video.platform === 'INSTAGRAM' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/30'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30'
              }`}>
                {platformName}
              </span>
              {video.category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                  {CATEGORY_NAMES[video.category]}
                </span>
              )}
            </div>
            <h1 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 leading-tight tracking-[-0.02em] mb-3">
              {video.title}
            </h1>
            {video.authorName && (
              <p className="text-sm text-zinc-400">
                작성자{' '}
                {video.authorUrl ? (
                  <a href={video.authorUrl} target="_blank" rel="noopener noreferrer"
                    className="text-zinc-100 hover:text-blue-500 transition-colors font-medium">
                    @{video.authorName}
                  </a>
                ) : (
                  <span className="text-zinc-100 font-medium">@{video.authorName}</span>
                )}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '조회수', value: formatCount(viewCount), Icon: Eye },
              { label: '좋아요', value: formatCount(likeCount), Icon: Heart },
              { label: '댓글', value: formatCount(commentCount), Icon: TrendingUp },
              { label: '참여율', value: `${engagement}%`, Icon: TrendingUp },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 shadow-card">
                <div className="flex items-center gap-1.5 mb-2">
                  <s.Icon size={12} className="text-zinc-400" />
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{s.label}</div>
                </div>
                <div className="text-display text-xl font-bold text-zinc-50 tabular-nums tracking-[-0.02em]">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons (the main "user wants this" block) */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-[0.18em]">바로가기</h2>

            {/* Video download */}
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-zinc-950 border border-zinc-700 hover:border-blue-500 rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shrink-0 shadow-sm">
                <Play size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-zinc-50 tracking-tight">영상 다운로드</div>
                <div className="text-xs text-zinc-400 mt-0.5">3rd-party 다운로더로 이동 (URL 자동 입력)</div>
              </div>
              <ExternalLink size={18} className="text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
            </a>

            {/* Wholesaler — 1688 */}
            <a
              href={wholesalerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-zinc-950 border border-zinc-700 hover:border-blue-500 rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-600 text-white shrink-0 shadow-sm font-bold text-sm">
                1688
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-zinc-50 tracking-tight">도매처 바로가기</div>
                <div className="text-xs text-zinc-400 mt-0.5">중국 1688 도매 사이트에서 같은 상품 검색</div>
              </div>
              <ExternalLink size={18} className="text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
            </a>

            {/* Seller link — Naver Shopping */}
            <a
              href={sellerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-zinc-950 border border-zinc-700 hover:border-blue-500 rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 text-white shrink-0 shadow-sm font-bold text-sm">
                N
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-zinc-50 tracking-tight">해당 상품 바로보기</div>
                <div className="text-xs text-zinc-400 mt-0.5">네이버 쇼핑에서 판매자/판매 링크 검색</div>
              </div>
              <ExternalLink size={18} className="text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
            </a>

            <p className="text-[11px] text-zinc-500 leading-relaxed pt-2">
              * 도매처/판매처 검색은 영상 제목 기반 자동 검색입니다.
              완전히 일치하는 상품이 안 나올 수 있어요. 검색 페이지에서 키워드를 다듬으면 정확도가 올라갑니다.
            </p>
          </div>

          {/* Description */}
          {video.description && (
            <div className="border-t border-zinc-700 pt-6">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">영상 설명</div>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line line-clamp-8">
                {video.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
