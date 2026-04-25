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

const RANK_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 border-amber-400',
  2: 'bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-900 border-zinc-300',
  3: 'bg-gradient-to-br from-orange-300 to-amber-600 text-orange-950 border-orange-400',
};

function rankClass(rank: number): string {
  return RANK_STYLES[rank] || 'bg-zinc-900 border border-zinc-700 text-zinc-300';
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-zinc-400">
          {!loading && videos.length > 0 && (
            <>
              <span className="text-zinc-50 font-bold">{videos.length}</span>개 인기 상품 (조회수 기준)
            </>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || scraping}
          className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 rounded-lg transition-all shadow-sm"
        >
          <Refresh size={14} className={scraping ? 'animate-spin' : ''} />
          {scraping ? '수집 중...' : '새로고침'}
        </button>
      </div>

      {scrapingStatus && (
        <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 rounded-lg px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
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
            className="inline-flex items-center gap-1.5 px-5 h-11 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 rounded-xl transition-all shadow-sm"
          >
            <Refresh size={14} className={scraping ? 'animate-spin' : ''} />
            {scraping ? '수집 중' : '데이터 수집하기'}
          </button>
        </div>
      )}

      {/* Ranked list */}
      {!loading && videos.length > 0 && (
        <div className="space-y-3">
          {videos.map((video, i) => {
            const rank = i + 1;
            const revenue = estimateRevenue(video.viewCount, video.likeCount, video.platform);
            return (
              <Link
                key={video.id + video.videoId}
                href={`/dashboard/${PLATFORM_PATH[video.platform]}/${video.id}`}
                className="group flex items-center gap-4 sm:gap-5 bg-zinc-950 border border-zinc-700 hover:border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-card hover:shadow-card-hover transition-all"
              >
                {/* Rank badge */}
                <div className={`shrink-0 inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-lg sm:text-xl font-bold border-2 ${rankClass(rank)}`}>
                  {rank}
                </div>

                {/* Thumbnail */}
                <div className="shrink-0 w-14 h-20 sm:w-16 sm:h-24 rounded-lg overflow-hidden bg-zinc-800 relative">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-[9px]">
                      이미지 없음
                    </div>
                  )}
                </div>

                {/* Title + meta */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-50 line-clamp-2 leading-snug tracking-tight mb-1">
                    {video.title || '무제'}
                  </h3>
                  <div className="text-xs text-zinc-400 truncate mb-2">
                    @{video.authorName || '알 수 없음'}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <Eye size={11} className="text-zinc-500" />
                      <span className="font-medium tabular-nums text-zinc-300">{formatCount(video.viewCount)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart size={11} className="text-zinc-500" />
                      <span className="font-medium tabular-nums text-zinc-300">{formatCount(video.likeCount)}</span>
                    </span>
                    {video.viralScore > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-semibold">
                        <TrendingUp size={10} strokeWidth={2.5} />
                        {video.viralScore > 1000 ? '999+' : Math.round(video.viralScore)}%
                      </span>
                    )}
                    {video.category && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-semibold">
                        {CATEGORY_NAMES[video.category]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Revenue + chevron */}
                <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">예상 매출</div>
                  <div className="text-display text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums tracking-[-0.02em]">
                    {formatKRW(revenue)}
                  </div>
                </div>

                <ChevronRight size={20} className="shrink-0 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
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
