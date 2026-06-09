'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Platform, Category } from '@prisma/client';
import {
  formatCount,
  formatKRW,
  estimateRevenue,
  CATEGORY_NAMES,
  PLATFORM_NAMES,
} from '@/lib/utils';
import { ChevronDown, ChevronRight, Refresh, TrendingUp, Eye, Heart } from '@/components/ui/Icon';
import SafeThumbnail from '@/components/ui/SafeThumbnail';

interface Video {
  id: string;
  platform: Platform;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string | null;
  viewCount: number;
  likeCount: number;
  viralScore: number;
  category: Category | null;
  targetAge: string | null;
}

interface Props {
  platform: Platform;
}

// 절제된 랭크 악센트 — 상위 3개만 은은한 컬러 텍스트/링, 나머지는 중립.
const RANK_ACCENT: Record<number, string> = {
  1: 'text-amber-300 ring-amber-400/40',
  2: 'text-zinc-200 ring-zinc-300/30',
  3: 'text-orange-300 ring-orange-400/30',
};

function rankAccent(rank: number): string {
  return RANK_ACCENT[rank] || 'text-zinc-300 ring-white/10';
}

const PLATFORM_PATH: Record<Platform, string> = {
  YOUTUBE: 'youtube',
  TIKTOK: 'tiktok',
  INSTAGRAM: 'instagram',
};

export default function RankedProductList({ platform }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const fetchVideos = useCallback(async (currentOffset: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('platform', platform);
      params.append('sortBy', 'viewCount'); // rank by view count primarily
      params.append('days', '30');
      params.set('limit', String(LIMIT));
      params.set('offset', String(currentOffset));
      const res = await fetch(`/api/videos?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (reset) { setVideos(data.videos); setOffset(LIMIT); }
      else { setVideos(prev => [...prev, ...data.videos]); setOffset(prev => prev + LIMIT); }
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류');
    } finally {
      if (reset) setLoading(false);
      setLoadingMore(false);
    }
  }, [platform]);

  useEffect(() => { fetchVideos(0, true); }, [fetchVideos]);

  const handleRefresh = async () => {
    try {
      setScraping(true);
      setScrapingStatus('새 트렌드 수집 중...');
      const res = await fetch('/api/trigger-collect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setScrapingStatus(`수집 완료 · ${data.results?.videosCollected || 0}개 신규 저장`);
      await fetchVideos(0, true);
      setTimeout(() => setScrapingStatus(''), 3000);
    } catch {
      setError('수집 실패');
      setScrapingStatus('');
    } finally { setScraping(false); }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-zinc-800/80 pb-4">
        <div className="flex items-baseline gap-2">
          {!loading && videos.length > 0 ? (
            <>
              <span className="text-2xl font-bold text-zinc-50 tabular-nums tracking-tight">{videos.length}</span>
              <span className="text-sm text-zinc-500">개 상품 · 조회수순 랭킹</span>
            </>
          ) : (
            <span className="text-sm text-zinc-500">랭킹</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || scraping}
          className="inline-flex items-center gap-2 px-3.5 h-9 text-[13px] font-medium text-zinc-200 bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/70 hover:border-zinc-600 disabled:opacity-50 rounded-lg transition-colors"
        >
          <Refresh size={13} className={scraping ? 'animate-spin' : ''} />
          {scraping ? '수집 중' : '새로고침'}
        </button>
      </div>

      {scrapingStatus && (
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg px-4 py-2.5 text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
          {scraping && <Refresh size={12} className="animate-spin" />}
          {scrapingStatus}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-lg px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24 text-sm text-zinc-400">
          <Refresh size={16} className="animate-spin mr-2" />
          순위 집계 중...
        </div>
      )}

      {!loading && videos.length === 0 && !error && (
        <div className="bg-zinc-950 border border-zinc-700 rounded-2xl py-20 text-center shadow-card">
          <p className="text-display text-xl font-bold text-zinc-50 mb-2 tracking-tight">아직 데이터가 없습니다</p>
          <p className="text-sm text-zinc-400 mb-6">새로고침을 눌러 최신 인기 상품을 수집하세요.</p>
          <button
            onClick={handleRefresh}
            disabled={scraping}
            className="inline-flex items-center gap-1.5 px-5 h-11 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm"
          >
            <Refresh size={14} className={scraping ? 'animate-spin' : ''} />
            {scraping ? '수집 중' : '데이터 수집하기'}
          </button>
        </div>
      )}

      {/* Ranked list */}
      {!loading && videos.length > 0 && (
        <div className="space-y-2.5">
          {videos.map((video, i) => {
            const rank = i + 1;
            const revenue = estimateRevenue(video.viewCount, video.likeCount, video.platform);
            const initial = (video.authorName || '?').replace(/^@/, '').charAt(0).toUpperCase();
            return (
              <Link
                key={video.id + video.videoId}
                href={`/dashboard/${PLATFORM_PATH[video.platform]}/${video.id}`}
                className="group relative flex items-stretch gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-3.5 hover:border-zinc-600 hover:bg-zinc-900/80 transition-colors"
              >
                {/* Thumbnail with rank overlay */}
                <div className="relative shrink-0 w-[72px] h-[100px] sm:w-[84px] sm:h-[116px] rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/5">
                  <SafeThumbnail
                    src={video.thumbnailUrl}
                    alt={video.title || ''}
                    platform={video.platform}
                    fallbackIconSize={22}
                    noShimmer
                  />
                  <span
                    className={`absolute top-1.5 left-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-lg bg-black/65 backdrop-blur-sm text-[12px] font-bold tabular-nums ring-1 ${rankAccent(rank)}`}
                  >
                    {rank}
                  </span>
                </div>

                {/* Title + meta */}
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-2 py-0.5">
                  <div>
                    <h3 className="text-[14px] sm:text-[15px] font-semibold text-zinc-50 line-clamp-2 leading-snug tracking-[-0.01em]">
                      {video.title || '무제'}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 truncate">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 text-[9px] font-semibold text-zinc-200 shrink-0">
                        {initial}
                      </span>
                      <span className="truncate">@{video.authorName || '알 수 없음'}</span>
                    </div>
                  </div>

                  {/* Metric chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-zinc-800/60 border border-zinc-700/50 text-[11px] text-zinc-300">
                      <Eye size={11} className="text-zinc-500" />
                      <span className="font-medium tabular-nums">{formatCount(video.viewCount)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-zinc-800/60 border border-zinc-700/50 text-[11px] text-zinc-300">
                      <Heart size={11} className="text-zinc-500" />
                      <span className="font-medium tabular-nums">{formatCount(video.likeCount)}</span>
                    </span>
                    {video.viralScore > 0 && (
                      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <TrendingUp size={10} strokeWidth={2.5} />
                        {video.viralScore > 1000 ? '999+' : Math.round(video.viralScore)}
                      </span>
                    )}
                    {video.category && (
                      <span className="inline-flex items-center h-6 px-2 rounded-md bg-blue-500/10 border border-blue-500/25 text-[11px] font-medium text-blue-600 dark:text-blue-300">
                        {CATEGORY_NAMES[video.category]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Revenue + chevron */}
                <div className="shrink-0 hidden sm:flex flex-col items-end justify-center gap-0.5 pl-2 border-l border-zinc-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">예상 월매출</div>
                  <div className="text-[17px] font-bold text-zinc-100 tabular-nums tracking-[-0.02em]">
                    {formatKRW(revenue)}
                  </div>
                  <div className="text-[10px] text-zinc-600">조회수 기반 추정</div>
                </div>

                <ChevronRight size={18} className="self-center shrink-0 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </Link>
            );
          })}

          {videos.length < total && (
            <div className="flex items-center justify-center pt-4">
              <button
                onClick={() => fetchVideos(offset, false)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 h-11 text-sm font-semibold text-zinc-100 bg-zinc-950 border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50 rounded-xl transition-colors"
              >
                {loadingMore ? '로딩 중...' : (<>더 보기 <ChevronDown size={14} /></>)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile-only revenue label legend */}
      <p className="sm:hidden text-[11px] text-zinc-500 px-1">
        * 예상 매출은 조회수·좋아요 기반 추정치입니다 ({PLATFORM_NAMES[platform]})
      </p>
    </div>
  );
}
