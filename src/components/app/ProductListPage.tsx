'use client';

import { useMemo, useState } from 'react';
import { Search } from '@/components/ui/Icon';

type Product = {
  id: string;
  title: string;
  desc: string;
  image: string;
  links: { label: string; href: string }[];
  marketDemand: number; // 0 – 10
  competition: number; // 0 – 10
  profitMargin: number; // %
  keywords: string[];
};

const LANGS = [
  { code: 'EN', label: 'EN' },
  { code: 'KO', label: 'KO' },
] as const;

const DEMAND_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High (8.0+)' },
  { value: 'medium', label: 'Medium (5.0–7.9)' },
  { value: 'low', label: 'Low (< 5.0)' },
] as const;

const COMP_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

// 임시 시드 데이터 — 추후 /api/products 와 교체
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p-001',
    title: 'Mini Portable Blender',
    desc: 'USB 충전식 휴대용 블렌더. 1인 가구·헬스 트렌드 + #TikTokMadeMeBuyIt 누적 8.4M 조회.',
    image: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=600&q=80',
    links: [
      { label: 'Link 1', href: '#' },
      { label: 'Link 2', href: '#' },
      { label: 'Link 3', href: '#' },
    ],
    marketDemand: 8.6,
    competition: 5.4,
    profitMargin: 42,
    keywords: ['portable blender', 'usb smoothie', 'mini gadget'],
  },
  {
    id: 'p-002',
    title: 'Cordless Electric Lint Remover',
    desc: '의류·소파용 보풀제거기. 가족 단위 구매 강함. Amazon Finds 채널에서 반복 노출.',
    image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&q=80',
    links: [
      { label: 'Link 1', href: '#' },
      { label: 'Link 2', href: '#' },
    ],
    marketDemand: 7.2,
    competition: 6.1,
    profitMargin: 55,
    keywords: ['lint remover', 'fabric shaver', 'home gadget'],
  },
  {
    id: 'p-003',
    title: 'LED Galaxy Star Projector',
    desc: '리모컨 + 블루투스 스피커 내장. Cozy/룸 인테리어 키워드와 결합해 Q4 강세.',
    image: 'https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?w=600&q=80',
    links: [
      { label: 'Link 1', href: '#' },
      { label: 'Link 2', href: '#' },
      { label: 'Link 3', href: '#' },
      { label: 'Link 4', href: '#' },
    ],
    marketDemand: 9.1,
    competition: 7.8,
    profitMargin: 38,
    keywords: ['star projector', 'cozy room', 'tiktokmademebuyit'],
  },
  {
    id: 'p-004',
    title: 'Toothbrush UV Sanitizer',
    desc: '욕실 벽걸이형. 위생·키즈 시장 동시 타깃. 단일 상품 쇼케이스 영상 비중 높음.',
    image: 'https://images.unsplash.com/photo-1559591935-c6c92c6cd5d5?w=600&q=80',
    links: [
      { label: 'Link 1', href: '#' },
      { label: 'Link 2', href: '#' },
    ],
    marketDemand: 6.4,
    competition: 3.9,
    profitMargin: 61,
    keywords: ['uv sanitizer', 'bathroom gadget', 'mom finds'],
  },
  {
    id: 'p-005',
    title: 'U-Shape Portable Mini AC',
    desc: '책상용 미니 에어컨. 여름 시즌 폭증. Rohan_Prasad 등 단일품 셀러 다수 진입.',
    image: 'https://images.unsplash.com/photo-1631545806609-cca3ec0d9b80?w=600&q=80',
    links: [
      { label: 'Link 1', href: '#' },
      { label: 'Link 2', href: '#' },
      { label: 'Link 3', href: '#' },
    ],
    marketDemand: 7.9,
    competition: 8.2,
    profitMargin: 29,
    keywords: ['mini ac', 'desk cooler', 'summer gadget'],
  },
  {
    id: 'p-006',
    title: 'Self-Stirring Mug',
    desc: '버튼 한 번에 자동 휘젓는 머그컵. 회사원·홈오피스 타깃, 클립 짧고 강함.',
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&q=80',
    links: [
      { label: 'Link 1', href: '#' },
      { label: 'Link 2', href: '#' },
    ],
    marketDemand: 5.8,
    competition: 4.5,
    profitMargin: 47,
    keywords: ['self stirring', 'office gadget', 'gift idea'],
  },
];

function demandBand(v: number): 'high' | 'medium' | 'low' {
  if (v >= 8) return 'high';
  if (v >= 5) return 'medium';
  return 'low';
}

function compBand(v: number): 'high' | 'medium' | 'low' {
  if (v >= 7) return 'high';
  if (v >= 4) return 'medium';
  return 'low';
}

export default function ProductListPage() {
  const [lang, setLang] = useState<string>('EN');
  const [keyword, setKeyword] = useState('');
  const [pendingKeyword, setPendingKeyword] = useState('');
  const [demand, setDemand] = useState<(typeof DEMAND_OPTIONS)[number]['value']>('all');
  const [competition, setCompetition] = useState<(typeof COMP_OPTIONS)[number]['value']>('all');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return MOCK_PRODUCTS.filter((p) => {
      if (kw) {
        const hay = `${p.title} ${p.desc} ${p.keywords.join(' ')}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (demand !== 'all' && demandBand(p.marketDemand) !== demand) return false;
      if (competition !== 'all' && compBand(p.competition) !== competition) return false;
      return true;
    });
  }, [keyword, demand, competition]);

  const onSearch = () => setKeyword(pendingKeyword);
  const onReset = () => {
    setKeyword('');
    setPendingKeyword('');
    setDemand('all');
    setCompetition('all');
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Hero */}
      <div className="mb-6 text-center">
        <h1 className="text-display text-3xl sm:text-4xl font-bold text-zinc-50 tracking-[-0.02em]">
          Trending Products <span className="text-blue-500">Database</span>
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 mt-3 max-w-2xl mx-auto leading-relaxed">
          이커머스 셀러를 위한 리서치 보드.
          <br />
          시장 수요·경쟁도·이익률을 한눈에 비교가 가능합니다.
        </p>

        {/* 보조 검색창 */}
        <div className="mt-5 max-w-xl mx-auto flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={pendingKeyword}
              onChange={(e) => setPendingKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              placeholder="상품·키워드 검색 (예: portable blender, lint remover)"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={onSearch}
            className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            Search
          </button>
        </div>

        {/* 언어 탭 */}
        <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-700">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-3 h-8 rounded-md text-xs font-semibold transition-colors ${
                lang === l.code
                  ? 'bg-zinc-50 text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Supplier Link CTA */}
        <div className="mt-5">
          <a
            href="#"
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-sm transition-colors"
          >
            Supplier Link →
          </a>
        </div>
      </div>

      {/* 필터 패널 */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={pendingKeyword}
                onChange={(e) => setPendingKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="키워드"
                className="w-full h-9 pl-8 pr-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={onSearch}
              className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              Search
            </button>
          </div>

          <select
            value={demand}
            onChange={(e) => setDemand(e.target.value as typeof demand)}
            className="h-9 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            {DEMAND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>Market Demand · {o.label}</option>
            ))}
          </select>

          <select
            value={competition}
            onChange={(e) => setCompetition(e.target.value as typeof competition)}
            className="h-9 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            {COMP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>Competition · {o.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            결과 <span className="text-zinc-100 font-semibold">{filtered.length}</span>개
          </span>
          <button
            onClick={onReset}
            className="px-3 h-7 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* 카드 리스트 */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-500">
            조건에 맞는 상품이 없습니다. 필터를 초기화해 보세요.
          </div>
        )}

        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const demandPct = Math.min(100, (product.marketDemand / 10) * 100);
  const compPct = Math.min(100, (product.competition / 10) * 100);

  return (
    <article className="flex flex-col sm:flex-row gap-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 sm:p-5 hover:border-zinc-600 transition-colors">
      {/* 좌: 이미지 */}
      <div className="sm:w-56 shrink-0">
        <div className="aspect-square w-full rounded-lg overflow-hidden bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {/* 우: 컨텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start gap-3 flex-wrap">
          <h3 className="text-lg sm:text-xl font-bold text-zinc-50 leading-tight">{product.title}</h3>
          <span className="inline-flex items-center px-2 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
            Profit Margin {product.profitMargin}%
          </span>
        </div>
        <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{product.desc}</p>

        {/* Link 버튼 묶음 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {product.links.map((l, i) => (
            <a
              key={i}
              href={l.href}
              className="inline-flex items-center h-7 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* 진행 막대 */}
        <div className="mt-4 space-y-2.5">
          <Bar
            label="Market Demand"
            value={product.marketDemand}
            pct={demandPct}
            color="rgba(67,236,19,0.9)"
          />
          <Bar
            label="Competition"
            value={product.competition}
            pct={compPct}
            color="rgba(245,200,40,0.9)"
          />
        </div>

        {/* 키워드 태그 */}
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 font-semibold mb-1.5">
            Search Keywords
          </div>
          <div className="flex flex-wrap gap-1.5">
            {product.keywords.map((k) => (
              <span
                key={k}
                className="inline-flex items-center h-6 px-2 rounded-full bg-zinc-800 text-zinc-300 text-[11px]"
              >
                #{k}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function Bar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-100 font-semibold tabular-nums">{value.toFixed(1)} / 10</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-label={label}
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
