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
  hidden?: boolean; // 관리자 응답에만 의미 있음 (일반 유저에겐 숨김 영상 자체가 안 옴)
  // v2 스코어링 (docs/COLLECTION_CRITERIA_V2.md) — 관리자 화면에서만 노출
  productScore?: number;
  tier?: string | null;
  viewsPerDay?: number;
  flags?: string[];
  userVerdict?: string | null;
}

/** Phase 0 라벨 — 운영자가 카드에서 바로 찍는 평가값. */
const VERDICT_BUTTONS = [
  { value: 'WINNER', label: '💰 소싱감', on: 'bg-emerald-500 text-white' },
  { value: 'MAYBE', label: '🤔 애매', on: 'bg-amber-500 text-white' },
  { value: 'REJECT', label: '❌ 탈락', on: 'bg-rose-600 text-white' },
] as const;

const VERDICT_FILTERS = [
  { value: '', label: '전체' },
  { value: 'UNRATED', label: '평가 대기' },
  { value: 'WINNER', label: '💰' },
  { value: 'MAYBE', label: '🤔' },
  { value: 'REJECT', label: '❌' },
] as const;

const TIER_STYLE: Record<string, string> = {
  S: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
  A: 'bg-sky-500 text-white',
  B: 'bg-zinc-600 text-zinc-100',
};

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState('');
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
      if (verdictFilter) params.append('verdict', verdictFilter);
      params.set('limit', String(LIMIT));
      params.set('offset', String(currentOffset));
      const response = await fetch(`/api/videos?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      const data = await response.json();
      if (reset) { setVideos(data.videos); setOffset(LIMIT); }
      else { setVideos(prev => [...prev, ...data.videos]); setOffset(prev => prev + LIMIT); }
      setTotal(data.total);
      setIsAdmin(!!data.isAdmin);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      if (reset) setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, platform, category, verdictFilter]);

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

  // ===== 관리자: 게이트를 뚫은 부적합 영상 숨김/삭제 =====
  const toggleHideVideo = async (video: Video) => {
    const res = await fetch(`/api/admin/videos/${video.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: !video.hidden }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || '숨김 처리에 실패했습니다');
      return;
    }
    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, hidden: !video.hidden } : v));
  };

  const deleteVideo = async (video: Video) => {
    if (!window.confirm('이 영상을 완전 삭제할까요? 재수집되면 다시 들어올 수 있어 보통은 숨김을 권장합니다.')) return;
    const res = await fetch(`/api/admin/videos/${video.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || '삭제에 실패했습니다');
      return;
    }
    setVideos(prev => prev.filter(v => v.id !== video.id));
    setTotal(t => Math.max(0, t - 1));
  };

  // ===== Phase 0 캘리브레이션: 운영자 라벨링 =====
  // 같은 버튼을 다시 누르면 평가 취소 — 잘못 찍은 라벨이 학습 데이터를 오염시키지 않게.
  const setVerdict = async (video: Video, verdict: string) => {
    const next = video.userVerdict === verdict ? null : verdict;
    setVideos(prev => prev.map(v => (v.id === video.id ? { ...v, userVerdict: next } : v)));
    const res = await fetch(`/api/admin/videos/${video.id}/verdict`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict: next }),
    });
    if (!res.ok) {
      // 실패 시 원래 값으로 되돌림 (낙관적 업데이트 롤백)
      setVideos(prev => prev.map(v => (v.id === video.id ? { ...v, userVerdict: video.userVerdict } : v)));
      const d = await res.json().catch(() => ({}));
      setError(d.error || '평가 저장에 실패했습니다');
    }
  };

  const ratedCount = videos.filter(v => v.userVerdict).length;

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

        {/* 캘리브레이션 라벨링 바 — 평가 대기분만 걸러 빠르게 찍고 진행률을 본다 */}
        {isAdmin && (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">평가</span>
              {VERDICT_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setVerdictFilter(f.value)}
                  className={`px-2.5 h-7 rounded-md text-xs font-semibold transition-colors ${
                    verdictFilter === f.value
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-zinc-400">
              이 목록 {videos.length}개 중 <span className="text-zinc-100 font-semibold">{ratedCount}</span>개 평가됨
              <a href="/admin/calibration" className="ml-3 text-sky-400 hover:text-sky-300 font-semibold">분석 보기 →</a>
            </div>
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
                <div key={video.id + video.videoId} className={`relative ${video.hidden ? 'opacity-40' : ''}`}>
                  <VideoCard
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
                  {isAdmin && (
                    <>
                      <div className="absolute top-2 right-2 z-10 flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleHideVideo(video); }}
                          title={video.hidden ? '숨김 해제' : '회원에게 숨김'}
                          className="px-2 h-7 rounded-md bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold backdrop-blur-sm"
                        >
                          {video.hidden ? '해제' : '숨김'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteVideo(video); }}
                          title="완전 삭제"
                          className="px-2 h-7 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-semibold backdrop-blur-sm"
                        >
                          삭제
                        </button>
                      </div>

                      {/* 점수 배지 — 캘리브레이션 중엔 점수가 아직 검증 전이라 관리자에게만 보인다 */}
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                        {video.flags?.includes('RISING') && (
                          <span
                            title="재수집 시 일 조회수 +20% 이상 — 워치리스트 승격 후보"
                            className="px-1.5 h-6 inline-flex items-center rounded-md bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[11px] font-bold"
                          >
                            🚀
                          </span>
                        )}
                        {video.tier && (
                          <span className={`px-1.5 h-6 inline-flex items-center rounded-md text-[11px] font-bold ${TIER_STYLE[video.tier] || 'bg-zinc-700 text-zinc-100'}`}>
                            {video.tier}
                          </span>
                        )}
                        {typeof video.productScore === 'number' && video.productScore > 0 && (
                          <span className="px-1.5 h-6 inline-flex items-center rounded-md bg-black/70 text-white text-[11px] font-semibold backdrop-blur-sm">
                            {video.productScore.toFixed(1)}<span className="opacity-60">/10</span>
                          </span>
                        )}
                        {typeof video.viewsPerDay === 'number' && video.viewsPerDay > 0 && (
                          <span className="px-1.5 h-6 inline-flex items-center rounded-md bg-black/70 text-white text-[11px] font-semibold backdrop-blur-sm" title="일 평균 조회수">
                            {Math.round(video.viewsPerDay / 1000).toLocaleString()}k/일
                          </span>
                        )}
                      </div>

                      {/* 라벨링 버튼 — 이 평가가 임계값 보정의 정답지가 된다 */}
                      <div className="mt-1.5 flex gap-1">
                        {VERDICT_BUTTONS.map((b) => (
                          <button
                            key={b.value}
                            onClick={(e) => { e.stopPropagation(); setVerdict(video, b.value); }}
                            className={`flex-1 h-7 rounded-md text-[11px] font-semibold transition-colors ${
                              video.userVerdict === b.value
                                ? b.on
                                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-700'
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
