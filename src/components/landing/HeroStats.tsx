import { getLandingStats } from '@/lib/landing-data';

export default async function HeroStats() {
  const stats = await getLandingStats();

  const items = [
    { label: '수집된 영상', value: stats.total.toLocaleString('ko-KR'), suffix: '개' },
    { label: '발견된 카테고리', value: stats.categoryCount.toLocaleString('ko-KR'), suffix: '개' },
    { label: '오늘 신규', value: stats.todayCount.toLocaleString('ko-KR'), suffix: '개' },
    { label: '연동 플랫폼', value: '3', suffix: '곳' },
  ];

  return (
    <div className="bg-zinc-950 border border-zinc-700 rounded-2xl shadow-card overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-zinc-700">
        {items.map((it) => (
          <div key={it.label} className="px-7 py-6 text-left">
            <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-zinc-400 mb-2">
              {it.label}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-display text-3xl sm:text-4xl font-bold text-zinc-50 tabular-nums tracking-[-0.025em]">
                {it.value}
              </span>
              <span className="text-base text-zinc-400 font-medium">{it.suffix}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
