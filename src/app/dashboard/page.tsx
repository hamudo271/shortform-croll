'use client';

import { useState, useEffect, useCallback } from 'react';
import VideoCard from '@/components/VideoCard';
import FilterBar, { FilterState } from '@/components/FilterBar';
import { Platform, Category } from '@prisma/client';

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

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    platform: '',
    category: '',
    targetAge: '',
    sortBy: 'viralScore',
    days: 7,
    search: '',
  });

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.category) params.set('category', filters.category);
      if (filters.targetAge) params.set('targetAge', filters.targetAge);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.days) params.set('days', String(filters.days));
      if (filters.search) params.set('search', filters.search);
      params.set('limit', '50');

      const response = await fetch(`/api/videos?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch videos');

      const data: VideosResponse = await response.json();
      setVideos(data.videos);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Platform stats
  const platformStats = videos.reduce(
    (acc, video) => {
      acc[video.platform] = (acc[video.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen relative selection:bg-purple-500/30">
      {/* Decorative Background Elements */}
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
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">Viral Shorts</h1>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                <span className="font-medium tracking-wide">Live: {total.toLocaleString()} Videos</span>
              </div>
              <button
                onClick={fetchVideos}
                disabled={loading}
                className="relative px-5 py-2 rounded-xl font-medium tracking-wide text-white overflow-hidden group disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 transition-transform group-hover:scale-[1.05]" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Refresh Data'
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-8 relative z-10 w-full mb-12">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-700/10 rounded-full blur-[20px] -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 shadow-inner">
                <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="text-sm font-medium text-zinc-400 tracking-wide uppercase">All Platforms</div>
            </div>
            <div className="text-3xl font-bold text-white tracking-tight relative z-10">{total.toLocaleString()}</div>
          </div>
          
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[30px] -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 shadow-[inset_0_1px_rgba(255,255,255,0.1)]">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-zinc-400 tracking-wide uppercase">YouTube Shorts</div>
            </div>
            <div className="text-3xl font-bold text-white tracking-tight relative z-10">{(platformStats.YOUTUBE || 0).toLocaleString()}</div>
          </div>
          
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400/10 rounded-full blur-[30px] -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2.5 rounded-xl bg-teal-400/10 border border-teal-400/20 shadow-[inset_0_1px_rgba(255,255,255,0.1)]">
                <svg className="w-5 h-5 text-[#2dd4bf]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.68l.01.03a6.33 6.33 0 0 0 11.45-3.32V7.72a8.31 8.31 0 0 0 5.25 2.15v-3.2a5.2 5.2 0 0 1-2.12-.02 4.93 4.93 0 0 1-2.02-.96Z"/>
                </svg>
              </div>
              <div className="text-sm font-medium text-zinc-400 tracking-wide uppercase">TikTok</div>
            </div>
            <div className="text-3xl font-bold text-white tracking-tight relative z-10">{(platformStats.TIKTOK || 0).toLocaleString()}</div>
          </div>
          
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-[30px] -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500" />
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-fuchsia-500/20 shadow-[inset_0_1px_rgba(255,255,255,0.1)]">
                <svg className="w-5 h-5 text-fuchsia-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </div>
              <div className="text-sm font-medium text-zinc-400 tracking-wide uppercase">Instagram Reels</div>
            </div>
            <div className="text-3xl font-bold text-white tracking-tight relative z-10">{(platformStats.INSTAGRAM || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar onFilterChange={handleFilterChange} initialFilters={filters} />

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl p-5 mb-8 flex items-start gap-4">
            <div className="p-2 bg-red-500/20 rounded-full text-red-400 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-1">Failed to load data</h3>
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
            <p className="text-zinc-500 mt-6 font-medium animate-pulse tracking-wide uppercase text-sm">Crunching data...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && videos.length === 0 && (
          <div className="flex flex-col flex-center items-center justify-center py-24 glass-card rounded-2xl border-dashed">
            <div className="w-20 h-20 mb-6 rounded-3xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shadow-inner transform -rotate-6">
              <span className="text-4xl">📭</span>
            </div>
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-200 to-zinc-500 mb-2">No videos found</h3>
            <p className="text-zinc-500 max-w-sm text-center">
              Adjust your filters or configure the scrapper to gather more insights.
            </p>
          </div>
        )}

        {/* Video Grid */}
        {!loading && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
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
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-8 mt-auto z-10 glass rounded-t-3xl mx-4 lg:mx-8 mb-0">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
             <span className="text-lg">🔥</span>
             <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-zinc-300 to-zinc-500">Viral Shorts</span>
          </div>
          <div className="text-sm font-medium text-zinc-600">
            Powered by Next.js & Tailwind CSS
          </div>
        </div>
      </footer>
    </div>
  );
}
