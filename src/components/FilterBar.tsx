'use client';

import { useState, useEffect, useRef } from 'react';
import { CATEGORY_NAMES, TARGET_AGE_OPTIONS } from '@/lib/utils';
import { Search, X, ChevronDown, Refresh } from '@/components/ui/Icon';

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export interface FilterState {
  platform: string;
  category: string;
  targetAge: string;
  country: string;
  sortBy: string;
  days: number;
  search: string;
}

const defaultFilters: FilterState = {
  platform: '', category: '', targetAge: '', country: '',
  sortBy: 'viralScore', days: 30, search: '',
};

export default function FilterBar({ onFilterChange, initialFilters }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters || defaultFilters);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!initialFilters) return;
    const changed = (Object.keys(initialFilters) as (keyof FilterState)[]).some(
      k => initialFilters[k] !== filters[k]
    );
    if (changed) {
      setFilters(initialFilters);
      setSearchInput(initialFilters.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilters?.platform, initialFilters?.category, initialFilters?.targetAge, initialFilters?.country, initialFilters?.sortBy, initialFilters?.days, initialFilters?.search]);

  const handleChange = (key: keyof FilterState, value: string | number) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleChange('search', value), 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      handleChange('search', searchInput);
    }
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    setSearchInput('');
    onFilterChange(defaultFilters);
  };

  const selectCls = 'appearance-none h-10 pl-4 pr-10 bg-zinc-950 border border-zinc-700 text-zinc-100 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 cursor-pointer text-sm font-medium transition-all hover:border-zinc-600';

  return (
    <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-4 shadow-card">
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="영상, 크리에이터, 키워드 검색"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-10 pl-10 pr-10 text-sm bg-background border border-zinc-700 rounded-xl text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); if (debounceRef.current) clearTimeout(debounceRef.current); handleChange('search', ''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-md transition-colors"
              aria-label="검색 초기화"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              value: filters.platform,
              key: 'platform' as keyof FilterState,
              options: [
                { value: '', label: '모든 플랫폼' },
                { value: 'YOUTUBE', label: '유튜브 쇼츠' },
                { value: 'TIKTOK', label: '틱톡' },
                { value: 'INSTAGRAM', label: '인스타 릴스' },
              ]
            },
            {
              value: filters.category,
              key: 'category' as keyof FilterState,
              options: [
                { value: '', label: '모든 카테고리' },
                ...Object.entries(CATEGORY_NAMES).map(([val, label]) => ({ value: val, label }))
              ]
            },
            {
              value: filters.targetAge,
              key: 'targetAge' as keyof FilterState,
              options: [
                { value: '', label: '모든 연령대' },
                ...TARGET_AGE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))
              ]
            },
            {
              value: filters.sortBy,
              key: 'sortBy' as keyof FilterState,
              options: [
                { value: 'viralScore', label: '바이럴 점수순' },
                { value: 'viewCount', label: '조회수순' },
                { value: 'likeCount', label: '좋아요순' },
                { value: 'collectedAt', label: '최신순' },
              ]
            },
            {
              value: filters.days,
              key: 'days' as keyof FilterState,
              options: [
                { value: 1, label: '오늘' },
                { value: 7, label: '최근 7일' },
                { value: 30, label: '최근 30일' },
              ]
            }
          ].map((filter, index) => (
            <div key={index} className="relative">
              <select
                value={filter.value}
                onChange={(e) => handleChange(filter.key, filter.key === 'days' ? parseInt(e.target.value) : e.target.value)}
                className={selectCls}
                style={{ WebkitAppearance: 'none' }}
              >
                {filter.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
            </div>
          ))}

          <button
            onClick={handleReset}
            className="inline-flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors"
            title="필터 초기화"
            aria-label="필터 초기화"
          >
            <Refresh size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
