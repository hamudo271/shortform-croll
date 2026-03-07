'use client';

import { useState } from 'react';
import { CATEGORY_NAMES, TARGET_AGE_OPTIONS } from '@/lib/utils';

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
  platform: '',
  category: '',
  targetAge: '',
  country: '',
  sortBy: 'viralScore',
  days: 7,
  search: '',
};

export default function FilterBar({ onFilterChange, initialFilters }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters || defaultFilters);
  const [searchInput, setSearchInput] = useState(filters.search);

  const handleChange = (key: keyof FilterState, value: string | number) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSearch = () => {
    handleChange('search', searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    setSearchInput('');
    onFilterChange(defaultFilters);
  };

  return (
    <div className="glass-card rounded-2xl p-5 mb-8 flex flex-col xl:flex-row xl:items-center gap-4 relative z-20">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[280px]">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="영상, 크리에이터 또는 키워드 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-11 pr-12 py-3 bg-zinc-900/50 border border-zinc-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-200 placeholder-zinc-500 transition-all shadow-inner"
        />
        {searchInput && (
          <button 
            onClick={() => { setSearchInput(''); handleChange('search', ''); }}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Combobox style Selects */}
        {[
          {
            value: filters.platform,
            key: 'platform' as keyof FilterState,
            options: [
              { value: '', label: '모든 플랫폼' },
              { value: 'YOUTUBE', label: '유튜브 쇼츠' },
              { value: 'TIKTOK', label: '틱톡' },
              { value: 'INSTAGRAM', label: '인스타그램 릴스' },
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
            value: filters.country,
            key: 'country' as keyof FilterState,
            options: [
              { value: '', label: '모든 국가' },
              { value: 'KR', label: '대한민국' },
              { value: 'US', label: '미국' },
              { value: 'JP', label: '일본' },
            ]
          },
          {
            value: filters.sortBy,
            key: 'sortBy' as keyof FilterState,
            options: [
              { value: 'viralScore', label: '🔥 바이럴 점수' },
              { value: 'viewCount', label: '👀 조회수' },
              { value: 'likeCount', label: '❤️ 좋아요' },
              { value: 'collectedAt', label: '⏱️ 최신순' },
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
          <div key={index} className="relative group">
            <select
              value={filter.value}
              onChange={(e) => handleChange(filter.key, filter.key === 'days' ? parseInt(e.target.value) : e.target.value)}
              className="appearance-none bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-300 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer font-medium text-sm w-full sm:w-auto"
              style={{ WebkitAppearance: 'none' }}
            >
              {filter.options.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-300">
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-zinc-500 group-hover:text-zinc-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        ))}

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="p-2.5 text-zinc-500 hover:text-white bg-zinc-800/30 hover:bg-zinc-800 border border-transparent hover:border-zinc-700/50 rounded-xl transition-all group ml-auto sm:ml-0"
          title="필터 초기화"
        >
          <svg className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
