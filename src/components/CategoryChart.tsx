'use client';

import { CATEGORY_NAMES } from '@/lib/utils';

interface CategoryChartProps {
  categories: Record<string, number>;
}

const CATEGORY_COLORS: Record<string, string> = {
  BEAUTY: '#f472b6',
  FOOD: '#fb923c',
  FASHION: '#a78bfa',
  ELECTRONICS: '#60a5fa',
  LIFESTYLE: '#34d399',
  HEALTH: '#4ade80',
  KIDS: '#fbbf24',
  OTHER: '#71717a',
};

export default function CategoryChart({ categories }: CategoryChartProps) {
  const entries = Object.entries(categories).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        데이터 없음
      </div>
    );
  }

  // Sort by count desc
  entries.sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {entries.map(([cat, count]) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        const color = CATEGORY_COLORS[cat] || '#71717a';
        const name = CATEGORY_NAMES[cat as keyof typeof CATEGORY_NAMES] || cat;

        return (
          <div key={cat} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                {name}
              </span>
              <span className="text-xs text-zinc-500 tabular-nums">
                {count}개 ({pct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}40`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
