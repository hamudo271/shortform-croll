'use client';

import { CATEGORY_NAMES } from '@/lib/utils';

interface CategoryChartProps {
  categories: Record<string, number>;
}

export default function CategoryChart({ categories }: CategoryChartProps) {
  const entries = Object.entries(categories).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (entries.length === 0) {
    return <div className="text-sm text-zinc-500 py-6">데이터 없음</div>;
  }

  entries.sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {entries.map(([cat, count]) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        const name = CATEGORY_NAMES[cat as keyof typeof CATEGORY_NAMES] || cat;
        return (
          <div key={cat}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm text-zinc-100 tracking-tight">{name}</span>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                {count.toLocaleString()} · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
