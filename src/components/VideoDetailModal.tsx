'use client';

import { useEffect, useCallback, useState } from 'react';
import { formatCount, PLATFORM_NAMES, CATEGORY_NAMES } from '@/lib/utils';
import { Platform, Category } from '@prisma/client';
import { X, Play, ExternalLink, TrendingUp, Sparkles } from '@/components/ui/Icon';
import SafeThumbnail from '@/components/ui/SafeThumbnail';

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

interface AIAnalysis {
  trendScore: number;
  trendReason: string;
  products: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  buyingIntent: number;
  summary: string;
}

const PLATFORM_DOT: Record<Platform, string> = {
  YOUTUBE: 'bg-red-500',
  TIKTOK: 'bg-teal-400',
  INSTAGRAM: 'bg-fuchsia-500',
};

export default function VideoDetailModal({ video, onClose }: VideoDetailModalProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  useEffect(() => {
    setAnalyzing(true);
    fetch(`/api/analyze?id=${video.id}`)
      .then(r => r.json())
      .then(d => setAnalysis(d.analysis))
      .catch(() => {})
      .finally(() => setAnalyzing(false));
  }, [video.id]);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(video.videoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-zinc-700 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-9 h-9 rounded-md bg-zinc-950/80 backdrop-blur-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>

        {/* Thumbnail */}
        <div className="relative w-full aspect-video bg-zinc-900 rounded-t-3xl overflow-hidden">
          <SafeThumbnail
            src={video.thumbnailUrl}
            alt={video.title}
            platform={video.platform}
            fallbackIconSize={72}
            eager
          />
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 hover:bg-zinc-950/30 transition-colors group"
            aria-label="영상 보기"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white group-hover:scale-105 transition-transform shadow-lg">
              <Play size={20} />
            </div>
          </a>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Meta row */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 uppercase tracking-wider">
            <span className="inline-flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_DOT[video.platform]}`} />
              {PLATFORM_NAMES[video.platform]}
            </span>
            {video.viralScore > 0 && (
              <span className="inline-flex items-center gap-1.5 text-zinc-100">
                <TrendingUp size={11} />
                바이럴 {video.viralScore > 1000 ? '999+' : Math.round(video.viralScore)}%
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-display text-xl sm:text-2xl font-semibold text-zinc-100 leading-tight tracking-[-0.02em]">
            {video.title}
          </h2>

          {/* Author */}
          {video.authorName && (
            <div className="text-sm text-zinc-400">
              {video.authorUrl ? (
                <a
                  href={video.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-100 transition-colors inline-flex items-center gap-1"
                >
                  @{video.authorName}
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span>@{video.authorName}</span>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-zinc-800 rounded-lg divide-x divide-zinc-800 [&>div:nth-child(3)]:border-t [&>div:nth-child(3)]:border-zinc-800 [&>div:nth-child(4)]:border-t [&>div:nth-child(4)]:border-zinc-800 sm:[&>div:nth-child(3)]:border-t-0 sm:[&>div:nth-child(4)]:border-t-0">
            {[
              { label: '조회수', value: formatCount(video.viewCount) },
              { label: '좋아요', value: formatCount(video.likeCount) },
              { label: '댓글', value: formatCount(video.commentCount) },
              { label: '참여율', value: `${engagement}%` },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mb-1">{s.label}</div>
                <div className="text-base font-semibold text-zinc-100 tabular-nums tracking-tight">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tags */}
          {(video.category || ageLabel || (video.tags && video.tags.length > 0)) && (
            <div className="flex flex-wrap gap-1.5">
              {video.category && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 text-xs font-semibold rounded-full">
                  {CATEGORY_NAMES[video.category]}
                </span>
              )}
              {ageLabel && (
                <span className="inline-flex items-center px-3 py-1 bg-sky-50 text-blue-700 dark:bg-sky-500/10 dark:text-blue-400 text-xs font-semibold rounded-full">
                  {ageLabel}
                </span>
              )}
              {video.tags?.map((tag) => (
                <span key={tag} className="inline-flex items-center px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* AI Analysis */}
          {analyzing ? (
            <div className="border border-zinc-800 rounded-lg p-4">
              <div className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
                <Sparkles size={12} className="animate-pulse" />
                AI 분석 중...
              </div>
            </div>
          ) : analysis && (
            <div className="border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider inline-flex items-center gap-1.5">
                <Sparkles size={12} />
                AI 분석
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: '트렌드', value: analysis.trendScore },
                  { label: '구매의도', value: analysis.buyingIntent },
                  { label: '감성', value: analysis.sentimentScore },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">{m.label}</div>
                      <span className="text-sm font-semibold text-zinc-100 tabular-nums">{m.value}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full transition-all" style={{ width: `${m.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {analysis.products.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mr-1">상품</span>
                  {analysis.products.map(p => (
                    <span key={p} className="px-2 py-0.5 border border-zinc-700 text-xs text-zinc-300 rounded">
                      {p}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-sm text-zinc-400 leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Description */}
          {video.description && (
            <div className="border-t border-zinc-800 pt-5">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-3">설명</div>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line line-clamp-6">
                {video.description}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-xl transition-all shadow-sm"
            >
              영상 보기
              <ExternalLink size={14} />
            </a>
            <button
              onClick={handleCopy}
              className="inline-flex items-center justify-center px-5 h-11 text-sm font-semibold text-zinc-100 border border-zinc-700 hover:bg-zinc-900 rounded-xl transition-colors"
            >
              {copied ? '복사됨' : '링크 복사'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
