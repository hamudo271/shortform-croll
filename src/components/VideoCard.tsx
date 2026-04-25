'use client';

import { memo, useState } from 'react';
import { formatCount, PLATFORM_NAMES, CATEGORY_NAMES } from '@/lib/utils';
import { Platform, Category } from '@prisma/client';
import { Eye, Heart, TrendingUp } from '@/components/ui/Icon';

const PLATFORM_DOT: Record<Platform, string> = {
  YOUTUBE: 'bg-red-500',
  TIKTOK: 'bg-teal-500',
  INSTAGRAM: 'bg-fuchsia-500',
};

const PLATFORM_BADGE: Record<Platform, string> = {
  YOUTUBE: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
  TIKTOK: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30',
  INSTAGRAM: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/30',
};

function ThumbnailImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-800 text-xs">
        썸네일 없음
      </div>
    );
  }

  return (
    <>
      {!loaded && <div className="absolute inset-0 bg-zinc-800" />}
      <img
        src={src} alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy" decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}

interface VideoCardProps {
  id: string;
  platform: Platform;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName?: string;
  viewCount: number;
  likeCount: number;
  viralScore: number;
  category?: Category | null;
  targetAge?: string | null;
  onClick?: () => void;
}

const VideoCard = memo(function VideoCard({
  platform, title, thumbnailUrl, authorName, viewCount, likeCount,
  viralScore, category, targetAge, onClick,
}: VideoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col text-left bg-zinc-950 border border-zinc-700 hover:border-zinc-500 rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-200"
      style={{ contain: 'layout paint' }}
    >
      <div className="relative aspect-[9/16] bg-zinc-800 overflow-hidden">
        <ThumbnailImage src={thumbnailUrl} alt={title || 'Video thumbnail'} />

        <div className={`absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PLATFORM_BADGE[platform]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[platform]}`} />
          {PLATFORM_NAMES[platform].split(' ')[0]}
        </div>

        {viralScore > 0 && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold shadow-sm">
            <TrendingUp size={10} strokeWidth={2.5} />
            {viralScore > 1000 ? '999+' : Math.round(viralScore)}%
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 gap-2.5">
        <h3 className="text-sm text-zinc-50 font-semibold leading-snug line-clamp-2 tracking-tight" title={title}>
          {title || '무제'}
        </h3>

        {authorName && (
          <p className="text-xs text-zinc-400 truncate">@{authorName}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
          <span className="inline-flex items-center gap-1">
            <Eye size={11} className="text-zinc-400" />
            {formatCount(viewCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart size={11} className="text-zinc-400" />
            {formatCount(likeCount)}
          </span>
        </div>

        {(category || targetAge) && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-zinc-700">
            {category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-semibold">
                {CATEGORY_NAMES[category]}
              </span>
            )}
            {targetAge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-medium">
                {targetAge === '10s' ? '10대' :
                 targetAge === '20s' ? '20대' :
                 targetAge === '30s' ? '30대' :
                 targetAge === '40s' ? '40대' : '50대+'}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
});

export default VideoCard;
