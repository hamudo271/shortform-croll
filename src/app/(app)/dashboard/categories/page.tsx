import PageHeader from '@/components/app/PageHeader';
import Link from 'next/link';
import { ChevronRight } from '@/components/ui/Icon';

const CATEGORIES = [
  { key: 'BEAUTY', label: '뷰티', emoji: '💄', color: 'from-pink-400 to-rose-500' },
  { key: 'FOOD', label: '식품', emoji: '🍱', color: 'from-orange-400 to-red-500' },
  { key: 'FASHION', label: '패션', emoji: '👗', color: 'from-purple-400 to-fuchsia-500' },
  { key: 'ELECTRONICS', label: '전자기기', emoji: '🎧', color: 'from-blue-400 to-indigo-500' },
  { key: 'LIFESTYLE', label: '라이프', emoji: '🏠', color: 'from-emerald-400 to-teal-500' },
  { key: 'HEALTH', label: '헬스/피트니스', emoji: '💪', color: 'from-cyan-400 to-blue-500' },
  { key: 'KIDS', label: '키즈/육아', emoji: '🧸', color: 'from-amber-400 to-yellow-500' },
];

export default function CategoriesPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="카테고리별"
        accent="모음"
        emoji="🗂️"
        description="관심 카테고리만 골라서 보세요."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/dashboard/categories/${c.key.toLowerCase()}`}
            className="group bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-4"
          >
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${c.color} text-white text-2xl shadow-sm shrink-0`}>
              {c.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-display text-lg font-bold text-zinc-50 tracking-[-0.015em]">
                {c.label}
              </div>
              <div className="text-xs text-zinc-400 mt-1">{c.key} 카테고리</div>
            </div>
            <ChevronRight size={18} className="text-zinc-400 group-hover:text-zinc-50 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
