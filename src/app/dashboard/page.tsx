'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import VideoCard from '@/components/VideoCard';
import VideoDetailModal from '@/components/VideoDetailModal';
import FilterBar, { FilterState } from '@/components/FilterBar';
import CategoryChart from '@/components/CategoryChart';
import { Platform, Category } from '@prisma/client';
import { getRelativeTime } from '@/lib/utils';

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

interface VideosResponse {
  videos: Video[];
  total: number;
  limit: number;
  offset: number;
}

interface StatsData {
  totalCount: number;
  platforms: Record<string, number>;
  categories: Record<string, number>;
  lastCollectedAt: string | null;
  topVideos: Video[];
  recentCollections: Array<{ date: string; count: number }>;
}

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const LIMIT = 24;

  const [filters, setFilters] = useState<FilterState>({
    platform: '',
    category: '',
    targetAge: '',
    sortBy: 'viralScore',
    days: 7,
    search: '',
    country: '',
  });

  // Fetch stats from dedicated endpoint
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchVideos = useCallback(async (currentOffset: number, reset: boolean) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.category) params.append('category', filters.category);
      if (filters.targetAge) params.append('targetAge', filters.targetAge);
      if (filters.country) params.append('country', filters.country);
      if (filters.search) params.append('search', filters.search);
      if (filters.days) params.append('days', filters.days.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      params.set('limit', String(LIMIT));
      params.set('offset', String(currentOffset));

      const response = await fetch(`/api/videos?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch videos');

      const data: VideosResponse = await response.json();
      if (reset) {
        setVideos(data.videos);
        setOffset(LIMIT);
      } else {
        setVideos(prev => [...prev, ...data.videos]);
        setOffset(prev => prev + LIMIT);
      }
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      if (reset) setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchVideos(0, true);
    fetchStats();
  }, [fetchVideos, fetchStats]);

  const loadMore = () => {
    fetchVideos(offset, false);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    // Scroll to grid on filter change
    setTimeout(() => {
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleRefreshData = async () => {
    try {
      setScraping(true);
      setScrapingStatus('트렌드 키워드 수집 중...');
      setError(null);

      const res = await fetch('/api/trigger-collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: filters.search }),
      });

      if (!res.ok) throw new Error('데이터 수집 요청에 실패했습니다');

      const data = await res.json();
      setScrapingStatus(
        `수집 완료! ${data.results?.videosCollected || 0}개 영상 저장, ${data.results?.videosSearched || 0}개 분석`
      );

      // Refresh data
      await Promise.all([fetchVideos(0, true), fetchStats()]);

      // Clear status after 3s
      setTimeout(() => setScrapingStatus(''), 3000);
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('시장 데이터를 갱신하는 데 실패했습니다');
      setScrapingStatus('');
    } finally {
      setScraping(false);
    }
  };

  const platformStats = stats?.platforms || {};
  const lastCollected = stats?.lastCollectedAt
    ? getRelativeTime(new Date(stats.lastCollectedAt))
    : null;

  return (
    <div className="min-h-screen relative selection:bg-purple-500/30">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-pink-600/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b-0 border-b-white/5 mx-4 mt-4 lg:mx-8 rounded-2xl transition-all duration-300">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                <span className="text-xl relative z-10" style={{ textShadow: "0 0 10px rgba(255,255,255,0.5)" }}>🔥</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">바이럴 쇼츠</h1>
                {lastCollected && (
                  <p className="text-[11px] text-zinc-500 mt-0.5">마지막 수집: {lastCollected}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              {/* Live count badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                <span className="font-medium tracking-wide text-xs">{(stats?.totalCount || total).toLocaleString()}개 영상</span>
              </div>

              {/* Refresh button */}
              <button
                onClick={handleRefreshData}
                disabled={loading || scraping}
                className="group relative px-5 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-100 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.3)] transition-all duration-300 border border-zinc-800 hover:border-zinc-600 disabled:opacity-50 flex items-center gap-2"
              >
                <div className={`absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 translate-x-[-100%] ${!(loading || scraping) && 'group-hover:animate-[shimmer_2s_infinite]'}`} />
                {scraping ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="relative z-10 text-sm font-medium">수집 중...</span>
                  </>
                ) : (
                  <>
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin opacity-50' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="relative z-10 text-sm font-medium text-white">{loading ? '로딩 중...' : '새로고침'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Scraping Status Banner */}
      {scrapingStatus && (
        <div className="mx-4 lg:mx-8 mt-3 max-w-[1400px] xl:mx-auto">
          <div className={`px-5 py-3 rounded-xl border text-sm font-medium flex items-center gap-3 transition-all ${
            scraping
              ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}>
            {scraping ? (
              <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {scrapingStatus}
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-4 py-8 relative z-10 w-full mb-12">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total */}
          <button
            onClick={() => handleFilterChange({ ...filters, platform: '' })}
            className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,255,255,0.08)] text-left"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-700/10 rounded-full blur-[20px] -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 group-hover:bg-zinc-700/80 transition-colors">
                <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">전체</span>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight relative z-10">{(stats?.totalCount || total).toLocaleString()}</div>
          </button>

          {/* YouTube */}
          <button
            onClick={() => handleFilterChange({ ...filters, platform: filters.platform === 'YOUTUBE' ? '' : 'YOUTUBE' })}
            className={`glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(239,68,68,0.15)] text-left ${filters.platform === 'YOUTUBE' ? 'ring-1 ring-red-500/40' : ''}`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[30px] -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 group-hover:bg-red-500/20 transition-colors">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-red-400/70 uppercase tracking-wider">유튜브</span>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight relative z-10">{(platformStats.YOUTUBE || 0).toLocaleString()}</div>
          </button>

          {/* TikTok */}
          <button
            onClick={() => handleFilterChange({ ...filters, platform: filters.platform === 'TIKTOK' ? '' : 'TIKTOK' })}
            className={`glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(45,212,191,0.15)] text-left ${filters.platform === 'TIKTOK' ? 'ring-1 ring-teal-500/40' : ''}`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400/10 rounded-full blur-[30px] -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="p-2 rounded-xl bg-teal-400/10 border border-teal-400/20 group-hover:bg-teal-400/20 transition-colors">
                <svg className="w-4 h-4 text-[#2dd4bf]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.68l.01.03a6.33 6.33 0 0 0 11.45-3.32V7.72a8.31 8.31 0 0 0 5.25 2.15v-3.2a5.2 5.2 0 0 1-2.12-.02 4.93 4.93 0 0 1-2.02-.96Z"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-teal-400/70 uppercase tracking-wider">틱톡</span>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight relative z-10">{(platformStats.TIKTOK || 0).toLocaleString()}</div>
          </button>

          {/* Instagram */}
          <button
            onClick={() => handleFilterChange({ ...filters, platform: filters.platform === 'INSTAGRAM' ? '' : 'INSTAGRAM' })}
            className={`glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(217,70,239,0.15)] text-left ${filters.platform === 'INSTAGRAM' ? 'ring-1 ring-fuchsia-500/40' : ''}`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-[30px] -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-fuchsia-500/20 group-hover:border-fuchsia-400/40 transition-colors">
                <svg className="w-4 h-4 text-fuchsia-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-fuchsia-400/70 uppercase tracking-wider">인스타</span>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight relative z-10">{(platformStats.INSTAGRAM || 0).toLocaleString()}</div>
          </button>
        </div>

        {/* Analytics Row - Category Chart + Top Videos */}
        {stats && (stats.categories && Object.keys(stats.categories).length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Category Distribution */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                카테고리 분포
              </h3>
              <CategoryChart categories={stats.categories} />
            </div>

            {/* Top Viral Videos */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Top 바이럴 영상
              </h3>
              <div className="space-y-2">
                {(stats.topVideos || []).slice(0, 5).map((video, i) => (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedVideo(video as Video)}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      i === 1 ? 'bg-zinc-400/20 text-zinc-300 border border-zinc-400/30' :
                      i === 2 ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' :
                      'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">
                        {video.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {video.authorName || '알 수 없음'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-amber-400">
                        {Math.round(video.viralScore)}%
                      </span>
                    </div>
                  </div>
                ))}
                {(!stats.topVideos || stats.topVideos.length === 0) && (
                  <p className="text-sm text-zinc-500 text-center py-4">데이터 없음</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <FilterBar onFilterChange={handleFilterChange} initialFilters={filters} />

        {/* Results info */}
        {!loading && videos.length > 0 && (
          <div className="flex items-center justify-between mb-4 px-1" ref={gridRef}>
            <p className="text-xs text-zinc-500">
              {total.toLocaleString()}개 중 {videos.length.toLocaleString()}개 표시
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl p-5 mb-8 flex items-start gap-4">
            <div className="p-2 bg-red-500/20 rounded-full text-red-400 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-1">데이터를 불러오는 데 실패했습니다</h3>
              <p className="text-sm text-red-400/80">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 glass-card rounded-2xl border-dashed">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 border-r-2 border-r-transparent animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-b-2 border-blue-500 border-l-2 border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              <div className="absolute inset-0 flex items-center justify-center text-xl">🔥</div>
            </div>
            <p className="text-zinc-500 mt-6 font-medium animate-pulse tracking-wide uppercase text-sm">데이터 분석 중...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 glass-card rounded-2xl border-dashed">
            <div className="w-20 h-20 mb-6 rounded-3xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shadow-inner transform -rotate-6">
              <span className="text-4xl">📭</span>
            </div>
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-500 mb-2">영상을 찾을 수 없습니다</h3>
            <p className="text-zinc-500 max-w-sm text-center mb-6">
              필터를 조정하거나 데이터를 새로고침해 보세요.
            </p>
            <button
              onClick={handleRefreshData}
              disabled={scraping}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              {scraping ? '수집 중...' : '데이터 수집하기'}
            </button>
          </div>
        )}

        {/* Video Grid */}
        {!loading && videos.length > 0 && (
          <div className="flex flex-col gap-8">
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

            {/* Load More */}
            {videos.length < total && (
              <div className="flex flex-col items-center gap-3 mt-4 mb-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 text-white font-medium transition-all shadow-lg backdrop-blur-md disabled:opacity-50 flex items-center gap-2 group"
                >
                  {loadingMore ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      로딩 중...
                    </>
                  ) : (
                    <>
                      더 보기
                      <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
                {/* Progress bar */}
                <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((videos.length / total) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-600">{videos.length} / {total}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-6 mt-auto z-10 glass rounded-t-3xl mx-4 lg:mx-8 mb-0">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-zinc-300 to-zinc-500">바이럴 쇼츠</span>
          </div>
          <div className="text-xs text-zinc-600">
            YouTube Data API + Google Trends + Gemini AI
          </div>
        </div>
      </footer>

      {/* Video Detail Modal */}
      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
