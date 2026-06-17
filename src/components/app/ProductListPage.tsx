'use client';

import { useEffect, useMemo, useState } from 'react';
import { SCOPE_PRODUCTS, SCOPE_CATEGORIES, type ScopeProduct } from '@/lib/trendscope-products';

type SortKey = 'score' | 'profit' | 'trend';

export default function ProductListPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('score');
  const [category, setCategory] = useState('all');
  const [curated, setCurated] = useState<ScopeProduct[]>([]); // 관리자 추가 상품

  useEffect(() => {
    fetch('/api/curated-products')
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((j) => setCurated(j.products || []))
      .catch(() => {});
  }, []);

  // 관리자(DB) 상품 + 정적 상품. 단, 정적 20개는 DB로 이관(seed)되었으므로
  // 같은 이름이 DB에 있으면 정적본을 제외해 중복을 막는다(=DB본이 우선, 수정 가능).
  // 아직 시드 전이면 정적본이 그대로 노출되어 화면이 바뀌지 않는다.
  const allProducts = useMemo(() => {
    const curatedNames = new Set(curated.map((c) => c.name));
    return [...curated, ...SCOPE_PRODUCTS.filter((s) => !curatedNames.has(s.name))];
  }, [curated]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allProducts
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => !q || [p.name, p.category, p.description, ...p.tags].join(' ').toLowerCase().includes(q))
      .sort((a, b) => b[sort] - a[sort]);
  }, [allProducts, query, sort, category]);

  const avgScore = Math.round(allProducts.reduce((s, p) => s + p.score, 0) / Math.max(1, allProducts.length));

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-5">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-blue-500 mb-2">Only researched products</p>
        <h1 className="text-display text-3xl sm:text-4xl font-bold text-zinc-50 tracking-[-0.02em]">Trending Products</h1>
        <p className="text-sm text-zinc-400 mt-3 max-w-sm mx-auto leading-relaxed">
          리서치로 검증된 트렌딩 상품 데이터베이스입니다. 카테고리·점수로 필터링하고 원본 소스를 바로 확인하세요.
        </p>
      </div>

      {/* Control card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 mb-3">
        <div className="grid grid-cols-[1fr_120px] gap-2 items-end">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-500">Search Product</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="상품명, 카테고리, 키워드"
              className="h-9 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-9 px-2 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="score">Score</option>
            <option value="profit">Profit</option>
            <option value="trend">Trend</option>
          </select>
        </div>
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto">
          {SCOPE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`min-h-[28px] px-2.5 rounded-md text-[11px] font-extrabold whitespace-nowrap border transition-colors ${
                category === c
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-zinc-800 mb-4">
        {[
          { n: allProducts.length, l: 'Total Products' },
          { n: 3, l: 'Verified Sources' },
          { n: avgScore, l: 'Avg. Score' },
        ].map((s) => (
          <div key={s.l} className="bg-zinc-900/40 p-2.5 text-center">
            <strong className="block text-xl font-bold text-zinc-50 tabular-nums">{s.n}</strong>
            <span className="block mt-1 text-[10px] font-bold text-zinc-500">{s.l}</span>
          </div>
        ))}
      </div>

      {/* List head */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <h2 className="text-base font-bold text-zinc-50">Product List</h2>
        <span className="text-xs font-bold text-blue-500">{items.length} products</span>
      </div>

      {/* Product list */}
      <div className="grid gap-3">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-700 py-12 text-center text-sm text-zinc-500">
            조건에 맞는 상품이 없습니다.
          </div>
        )}
        {items.map((p, i) => (
          <ProductCard key={p.id ?? p.name} product={p} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function metricColor(kind: 'green' | 'yellow' | 'orange'): string {
  return kind === 'green'
    ? 'bg-emerald-500'
    : kind === 'yellow'
      ? 'bg-amber-400'
      : 'bg-orange-500';
}

function Metric({ label, value, color }: { label: string; value: number; color: 'green' | 'yellow' | 'orange' }) {
  return (
    <div className="grid grid-cols-[58px_1fr_30px] items-center gap-2 text-[10px] font-bold text-zinc-400">
      <span>{label}</span>
      <span className="h-[5px] rounded-full bg-zinc-800 overflow-hidden">
        <span className={`block h-full rounded-full ${metricColor(color)}`} style={{ width: `${value}%` }} />
      </span>
      <strong className="text-right tabular-nums text-zinc-300">{value}</strong>
    </div>
  );
}

function ProductCard({ product, rank }: { product: ScopeProduct; rank: number }) {
  return (
    <article className="grid grid-cols-[100px_minmax(0,1fr)] sm:grid-cols-[118px_minmax(0,1fr)] gap-3 p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:-translate-y-px transition-all">
      {/* thumb */}
      <div className="relative w-[100px] h-[100px] sm:w-[118px] sm:h-[118px] rounded-md overflow-hidden border border-zinc-800 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
        <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center min-w-[26px] h-5 px-1 rounded bg-[#0b1220]/85 text-white text-[10px] font-bold">
          #{String(rank).padStart(2, '0')}
        </span>
      </div>

      {/* body */}
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-bold text-zinc-50 leading-snug">{product.name}</h3>
          <span className="inline-flex items-center justify-center min-w-[38px] h-6 px-1.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold tabular-nums shrink-0">
            {product.score}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed mb-2 line-clamp-2">{product.description}</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {product.tags.map((t) => (
            <span key={t} className="inline-flex items-center min-h-[22px] px-1.5 rounded bg-zinc-800 text-zinc-300 text-[9px] font-bold">
              {t}
            </span>
          ))}
        </div>
        <div className="grid gap-1.5 mb-2">
          <Metric label="Trend" value={product.trend} color="green" />
          <Metric label="Profit" value={product.profit} color="yellow" />
          <Metric label="Comp." value={product.competition} color="orange" />
        </div>
        <div className="flex items-center gap-1.5">
          {product.source ? (
            <a
              href={product.source}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center h-7 px-3 rounded-md bg-blue-600 text-white text-[10px] font-extrabold hover:bg-blue-700 transition-colors"
            >
              Source
            </a>
          ) : (
            <button disabled className="inline-flex items-center h-7 px-3 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-600 text-[10px] font-extrabold cursor-not-allowed">
              확인 필요
            </button>
          )}
          <button className="inline-flex items-center h-7 px-3 rounded-md border border-zinc-700 bg-zinc-950 text-blue-500 text-[10px] font-extrabold hover:bg-zinc-900 transition-colors">
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
