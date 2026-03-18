'use client';

import { memo } from 'react';
import Image from 'next/image';
import { formatCount, PLATFORM_NAMES, CATEGORY_NAMES } from '@/lib/utils';
import { Platform, Category } from '@prisma/client';

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

const platformColors: Record<Platform, { bg: string; text: string; icon: string; border: string; badgeText: string }> = {
  YOUTUBE: { bg: 'bg-red-500/10', text: 'text-red-400', icon: '▶️', border: 'border-red-500/20', badgeText: 'text-red-300' },
  TIKTOK: { bg: 'bg-[#2dd4bf]/10', text: 'text-[#2dd4bf]', icon: '🎵', border: 'border-[#2dd4bf]/20', badgeText: 'text-[#2dd4bf]' },
  INSTAGRAM: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', icon: '📷', border: 'border-fuchsia-500/20', badgeText: 'text-fuchsia-300' },
};

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
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title || 'Video thumbnail'}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
            quality={75}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-800/50">
            이미지 없음
          </div>
        )}

        {/* Top Overlay Gradient */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />

        {/* Platform Badge */}
        <div
          className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg backdrop-blur-md text-xs font-semibold tracking-wide flex items-center gap-1.5 ${platformStyle.bg} ${platformStyle.badgeText} border ${platformStyle.border} shadow-lg`}
        >
          <span>{platformStyle.icon}</span>
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
