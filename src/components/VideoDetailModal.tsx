'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import { formatCount, PLATFORM_NAMES, CATEGORY_NAMES } from '@/lib/utils';
import { Platform, Category } from '@prisma/client';

interface VideoDetailModalProps {
  video: {
    id: string;
    platform: Platform;
    videoId: string;
    title: string;
    description: string | null;
    thumbnailUrl: string;
    videoUrl: string;
    authorName: string | null;
    authorUrl: string | null;
    viewCount: number;
    likeCount: number;
    shareCount: number;
    commentCount: number;
    viralScore: number;
    category: Category | null;
    targetAge: string | null;
    tags: string[];
    collectedAt: string;
  };
  onClose: () => void;
}

export default function VideoDetailModal({ video, onClose }: VideoDetailModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const engagement = video.viewCount > 0
    ? ((video.likeCount / video.viewCount) * 100).toFixed(1)
    : '0';

  const ageLabel = video.targetAge
    ? video.targetAge === '10s' ? '10대'
    : video.targetAge === '20s' ? '20대'
    : video.targetAge === '30s' ? '30대'
    : video.targetAge === '40s' ? '40대'
    : '50대+'
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-3xl border border-zinc-700/50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-400 hover:text-white transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-zinc-900 rounded-t-3xl overflow-hidden">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              이미지 없음
            </div>
          )}
          {/* Play overlay */}
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
          >
            <div className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 rounded-full p-5 transition-all group-hover:scale-110">
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </a>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Platform + Viral Score */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              {PLATFORM_NAMES[video.platform]}
            </span>
            {video.viralScore > 0 && (
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-sm font-bold text-amber-300 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                바이럴 점수: {video.viralScore > 1000 ? '999+' : Math.round(video.viralScore)}%
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-white leading-snug">{video.title}</h2>

          {/* Author */}
          {video.authorName && (
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-400">@</span>
              {video.authorUrl ? (
                <a
                  href={video.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  {video.authorName}
                </a>
              ) : (
                <span className="text-sm font-medium text-zinc-400">{video.authorName}</span>
              )}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '조회수', value: formatCount(video.viewCount), icon: '👀', color: 'text-blue-400' },
              { label: '좋아요', value: formatCount(video.likeCount), icon: '❤️', color: 'text-pink-400' },
              { label: '댓글', value: formatCount(video.commentCount), icon: '💬', color: 'text-emerald-400' },
              { label: '참여율', value: `${engagement}%`, icon: '📊', color: 'text-amber-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                <div className="text-xs text-zinc-500 mb-1">{stat.icon} {stat.label}</div>
                <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {video.category && (
              <span className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg text-xs font-medium">
                {CATEGORY_NAMES[video.category]}
              </span>
            )}
            {ageLabel && (
              <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-xs font-medium">
                {ageLabel}
              </span>
            )}
            {video.tags?.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/30 text-zinc-400 rounded-lg text-xs"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Description */}
          {video.description && (
            <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/20">
              <div className="text-xs text-zinc-500 mb-2 font-medium">설명</div>
              <p className="text-sm text-zinc-400 whitespace-pre-line line-clamp-6">
                {video.description}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-purple-500/20"
            >
              영상 보기
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(video.videoUrl);
              }}
              className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 rounded-xl font-medium text-sm transition-all"
            >
              링크 복사
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
