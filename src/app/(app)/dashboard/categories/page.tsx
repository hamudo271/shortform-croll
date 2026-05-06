import PageHeader from '@/components/app/PageHeader';
import Link from 'next/link';
import {
  ChevronRight,
  Lipstick,
  Utensils,
  Shirt,
  Smartphone,
  Home,
  Dumbbell,
  Baby,
} from '@/components/ui/Icon';

const CATEGORIES = [
  { key: 'BEAUTY', label: '뷰티', Icon: Lipstick },
  { key: 'FOOD', label: '식품', Icon: Utensils },
  { key: 'FASHION', label: '패션', Icon: Shirt },
  { key: 'ELECTRONICS', label: '전자기기', Icon: Smartphone },
  { key: 'LIFESTYLE', label: '라이프', Icon: Home },
  { key: 'HEALTH', label: '헬스/피트니스', Icon: Dumbbell },
  { key: 'KIDS', label: '키즈/육아', Icon: Baby },
];

export default function CategoriesPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader
        title="카테고리별"
        accent="모음"
        description="관심 카테고리만 골라서 보세요."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/dashboard/categories/${c.key.toLowerCase()}`}
            className="group bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card hover:shadow-card-hover hover:border-blue-500 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-4"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 shrink-0 group-hover:border-blue-500 group-hover:text-blue-400 transition-colors">
              <c.Icon size={26} strokeWidth={1.5} />
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
