'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import VideoCard from '@/components/VideoCard';
import VideoDetailModal from '@/components/VideoDetailModal';
import FilterBar, { FilterState } from '@/components/FilterBar';
import { Platform, Category } from '@prisma/client';
import { ChevronDown, Refresh } from '@/components/ui/Icon';

interface Video {
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
}

interface Props {
  /** Restrict to a single platform; omit for all platforms. */
  platform?: Platform;
  /** Restrict to a single category. */
  category?: Category;
  /** Initial query passed to filter bar (and pinned to URL). */
  initialFilters?: Partial<FilterState>;
  /** Whether the user can trigger a fresh collect from this page. */
  showRefresh?: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  platform: '',
  category: '',
  targetAge: '',
  country: '',
  sortBy: 'viralScore',
  days: 30,
  search: '',
};

export default function VideoListPage({ platform, category, initialFilters, showRefresh = true }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const LIMIT = 24;

  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    ...(platform ? { platform } : {}),
    ...(category ? { category } : {}),
    ...initialFilters,
  });

  const fetchVideos = useCallback(async (currentOffset: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      // Locked filters (from props) override user filters where set.
      const effectivePlatform = platform || filters.platform;
      const effectiveCategory = category || filters.category;
      if (effectivePlatform) params.append('platform', effectivePlatform);
      if (effectiveCategory) params.append('category', effectiveCategory);
      if (filters.targetAge) params.append('targetAge', filters.targetAge);
      if (filters.country) params.append('country', filters.country);
      if (filters.search) params.append('search', filters.search);
      if (filters.days) params.append('days', filters.days.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      params.set('limit', String(LIMIT));
      params.set('offset', String(currentOffset));
      const response = await fetch(`/api/videos?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      const data = await response.json();
      if (reset) { setVideos(data.videos); setOffset(LIMIT); }
      else { setVideos(prev => [...prev, ...data.videos]); setOffset(prev => prev + LIMIT); }
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      if (reset) setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, platform, category]);

  useEffect(() => { fetchVideos(0, true); }, [fetchVideos]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setTimeout(() => { gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const handleRefreshData = async () => {
    try {
      setScraping(true);
      setScrapingStatus('트렌드 키워드 수집 중...');
      setError(null);
      const res = await fetch('/api/trigger-collect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: filters.search }),
      });
      if (!res.ok) throw new Error('데이터 수집 요청에 실패했습니다');
      const data = await res.json();
      setScrapingStatus(`수집 완료 · ${data.results?.videosCollected || 0}개 저장`);
      await fetchVideos(0, true);
      setTimeout(() => setScrapingStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setError('시장 데이터를 갱신하는 데 실패했습니다');
      setScrapingStatus('');
    } finally { setScraping(false); }
  };

  const loadMore = () => fetchVideos(offset, false);

  return (
    <>
      <div className="space-y-6" ref={gridRef}>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-zinc-400">
            {!loading && videos.length > 0 && (
              <>
                <span className="text-zinc-50 font-semibold">{total.toLocaleString()}</span>개 중{' '}
                <span className="text-zinc-50 font-semibold">{videos.length.toLocaleString()}</span>개 표시
              </>
            )}
          </div>
          {showRefresh && (
            <button
              onClick={handleRefreshData}
              disabled={loading || scraping}
              className="inline-flex items-center gap-1.5 px-4 h-10 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 rounded-lg transition-all shadow-sm"
            >
              <Refresh size={14} className={scraping ? 'animate-spin' : ''} />
              {scraping ? '수집 중...' : '새로고침'}
            </button>
          )}
        </div>

        {scrapingStatus && (
          <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg px-4 py-2.5 text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
            {scraping && <Refresh size={12} className="animate-spin" />}
            {scrapingStatus}
          </div>
        )}

        <FilterBar onFilterChange={handleFilterChange} initialFilters={filters} />

        {error && (
          <div className="bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-lg px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-24 text-sm text-zinc-400">
            <Refresh size={16} className="animate-spin mr-2" />
            데이터 불러오는 중...
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="bg-zinc-950 border border-zinc-700 rounded-2xl py-20 text-center shadow-card">
            <p className="text-display text-xl font-bold text-zinc-50 mb-2 tracking-tight">영상을 찾을 수 없습니다</p>
            <p className="text-sm text-zinc-400 mb-8">필터를 조정하거나 데이터를 새로고침해 보세요.</p>
            {showRefresh && (
              <button
                onClick={handleRefreshData}
                disabled={scraping}
                className="inline-flex items-center gap-1.5 px-5 h-11 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm"
              >
                <Refresh size={14} className={scraping ? 'animate-spin' : ''} />
                {scraping ? '수집 중' : '데이터 수집하기'}
              </button>
            )}
          </div>
        )}

        {!loading && videos.length > 0 && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id + video.videoId}
                  id={video.id}
                  platform={video.platform}
                  title={video.title}
                  thumbnailUrl={video.thumbnailUrl}
                  videoUrl={video.videoUrl}
                  authorName={video.authorName || undefined}
                  viewCount={video.viewCount}
                  likeCount={video.likeCount}
                  viralScore={video.viralScore}
                  category={video.category}
                  targetAge={video.targetAge}
                  onClick={() => setSelectedVideo(video)}
                />
              ))}
            </div>
            {videos.length < total && (
              <div className="flex items-center justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 h-11 text-sm font-semibold text-zinc-100 bg-zinc-950 border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {loadingMore ? '로딩 중...' : (<>더 보기 <ChevronDown size={14} /></>)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedVideo && (
        <VideoDetailModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}
    </>
  );
}
