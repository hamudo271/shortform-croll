'use client';

import { memo, useState } from 'react';
import { formatCount, PLATFORM_NAMES, CATEGORY_NAMES } from '@/lib/utils';
import { Platform, Category } from '@prisma/client';

function ThumbnailImage({ src, alt, platform }: { src: string; alt: string; platform: Platform }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-800/50 gap-2">
        <PlatformIcon platform={platform} className="w-8 h-8 text-zinc-600" />
        <span className="text-xs">썸네일 없음</span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
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

const platformColors: Record<Platform, { bg: string; text: string; border: string; badgeText: string; iconColor: string }> = {
  YOUTUBE: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', badgeText: 'text-red-300', iconColor: 'text-red-500' },
  TIKTOK: { bg: 'bg-[#2dd4bf]/10', text: 'text-[#2dd4bf]', border: 'border-[#2dd4bf]/20', badgeText: 'text-[#2dd4bf]', iconColor: 'text-[#2dd4bf]' },
  INSTAGRAM: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20', badgeText: 'text-fuchsia-300', iconColor: 'text-fuchsia-400' },
};

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  if (platform === 'YOUTUBE') {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" />
      </svg>
    );
  }
  if (platform === 'TIKTOK') {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.68l.01.03a6.33 6.33 0 0 0 11.45-3.32V7.72a8.31 8.31 0 0 0 5.25 2.15v-3.2a5.2 5.2 0 0 1-2.12-.02 4.93 4.93 0 0 1-2.02-.96Z"/>
      </svg>
    );
  }
  // INSTAGRAM
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

const VideoCard = memo(function VideoCard({
  platform,
  title,
  thumbnailUrl,
  videoUrl,
  authorName,
  viewCount,
  likeCount,
  viralScore,
  category,
  targetAge,
  onClick,
}: VideoCardProps) {
  const platformStyle = platformColors[platform];

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col h-full transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] bg-zinc-900 border-b border-zinc-800/80 overflow-hidden">
        <ThumbnailImage
          src={thumbnailUrl}
          alt={title || 'Video thumbnail'}
          platform={platform}
        />

        {/* Top Overlay Gradient */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />

        {/* Platform Badge */}
        <div
          className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg backdrop-blur-md text-xs font-semibold tracking-wide flex items-center gap-1.5 ${platformStyle.bg} ${platformStyle.badgeText} border ${platformStyle.border} shadow-lg`}
        >
          <PlatformIcon platform={platform} className={`w-3.5 h-3.5 ${platformStyle.iconColor}`} />
          <span className="uppercase text-[10px]">{PLATFORM_NAMES[platform].split(' ')[0]}</span>
        </div>

        {/* Viral Score Badge */}
        {viralScore > 0 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg backdrop-blur-md bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center gap-1">
            <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {viralScore > 1000 ? '999+' : Math.round(viralScore)}%
          </div>
        )}

        {/* Bottom Overlay Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950 via-zinc-900/80 to-transparent flex flex-col justify-end p-4">
          {/* Play Button Overlay (visible on hover) */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="transform scale-75 group-hover:scale-100 transition-all duration-300 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full p-4 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </a>
          </div>

          <div className="relative z-10">
            {/* Title */}
            <h3 className="font-semibold text-sm text-zinc-100 line-clamp-2 leading-snug drop-shadow-md mb-2" title={title}>
              {title || '무제'}
            </h3>

            {/* Author */}
            {authorName && (
              <p className="text-xs font-medium text-zinc-400 truncate flex items-center gap-1.5 drop-shadow-md">
                <span className="w-4 h-4 rounded-full bg-zinc-700/50 border border-zinc-600 flex items-center justify-center text-[8px] text-zinc-300">@</span>
                {authorName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 bg-zinc-900/40">
        {/* Stats */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1.5 rounded-lg text-zinc-300 border border-zinc-700/50">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {formatCount(viewCount)}
            </span>
            <span className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1.5 rounded-lg text-zinc-300 border border-zinc-700/50">
              <svg className="w-3.5 h-3.5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {formatCount(likeCount)}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-zinc-800/50">
          {category && (
            <span className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-md text-[10px] font-medium uppercase tracking-wider">
              {CATEGORY_NAMES[category]}
            </span>
          )}
          {targetAge && (
            <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-md text-[10px] font-medium uppercase tracking-wider">
              {targetAge === '10s' ? '10대' :
               targetAge === '20s' ? '20대' :
               targetAge === '30s' ? '30대' :
               targetAge === '40s' ? '40대' : '50대+'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default VideoCard;
