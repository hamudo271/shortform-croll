'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from '@/components/ui/Icon';

type Product = {
  id: string;
  videoId: string;
  platform: string;
  title: string;
  desc: string;
  image: string;
  thumbnailRaw?: string;
  authorName: string | null;
  category: string | null;
  keywords: string[];
  links: { label: string; href: string }[];
  marketDemand: number; // 0 – 10 (DPM 기반)
  competition: number; // 0 – 10 (콘텐츠 포화도 베타)
  viewCount: number;
  commentCount: number;
  purchaseIntentScore: number;
  passReason: string | null;
  publishedAt: string | null;
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

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // 기본 passReason='both' — strongest buyer-intent 만. IG creator_link 만 포함하려면
    // '/api/products?passReason=all' 로 호출.
    fetch('/api/products?passReason=both&days=30&limit=60')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setProducts(json.products || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return products.filter((p) => {
      if (kw) {
        const hay = `${p.title} ${p.desc} ${(p.keywords || []).join(' ')} ${p.authorName || ''}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (demand !== 'all' && demandBand(p.marketDemand) !== demand) return false;
      if (competition !== 'all' && compBand(p.competition) !== competition) return false;
      return true;
    });
  }, [products, keyword, demand, competition]);

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
              <option key={o.value} value={o.value}>콘텐츠 포화도 · {o.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            결과 <span className="text-zinc-100 font-semibold">{filtered.length}</span>개
            {loading && <span className="ml-2 text-zinc-500">· 불러오는 중…</span>}
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
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            데이터를 불러오지 못했습니다 — {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
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
        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-zinc-800">
          <ProductImage
            primary={product.image}
            fallback={product.thumbnailRaw}
            alt={product.title}
          />
        </div>
      </div>

      {/* 우: 컨텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start gap-3 flex-wrap">
          <h3 className="text-base sm:text-lg font-bold text-zinc-50 leading-snug line-clamp-2">
            {product.title}
          </h3>
          {product.platform && (
            <span className="inline-flex items-center px-2 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-semibold uppercase shrink-0">
              {product.platform}
            </span>
          )}
        </div>
        {product.authorName && (
          <div className="text-xs text-zinc-500 mt-1">@{product.authorName}</div>
        )}
        {product.desc && (
          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed line-clamp-2">{product.desc}</p>
        )}

        {/* Link 버튼 묶음 */}
        <div className="mt-3 flex flex-wrap gap-2">
          {product.links.map((l, i) => (
            <a
              key={i}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
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
            label="콘텐츠 포화도 (베타)"
            value={product.competition}
            pct={compPct}
            color="rgba(245,200,40,0.9)"
            hint="같은 카테고리 내 후보 수 기반 추정치"
          />
        </div>

        {/* 키워드 태그 */}
        {product.keywords?.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 font-semibold mb-1.5">
              Search Keywords
            </div>
            <div className="flex flex-wrap gap-1.5">
              {product.keywords.slice(0, 8).map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center h-6 px-2 rounded-full bg-zinc-800 text-zinc-300 text-[11px]"
                >
                  #{k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Resilient 썸네일.
 *
 * TikTok 썸네일 프록시(/api/thumbnail/tiktok)는 tikwm 를 1.1s 간격 직렬 호출해서
 * 콜드 캐시 + 동시 다수 로드 시 꼬리 요청이 응답을 못 받고 무한 pending 에 빠지는
 * 케이스가 있다(에러도 아니라 onError 도 안 뜸). 저장된 원본 thumbnailRaw 는 이미
 * 만료돼 있는 경우가 많아 폴백으로도 부적합.
 *
 * 해결: onError 뿐 아니라 "로드 타임아웃"으로도 복구를 발동한다.
 *  - 4s 안에 onLoad 가 안 오면 실패로 간주.
 *  - 복구는 프록시를 캐시버스트 쿼리로 재요청 → 이때쯤 서버 캐시가 데워져 즉시 응답.
 *  - 두 번 재시도 후에도 실패하면 원본 폴백 → 그래도 안 되면 플레이스홀더.
 */
const LOAD_TIMEOUT_MS = 4000;

function ProductImage({
  primary,
  fallback,
  alt,
}: {
  primary: string;
  fallback?: string;
  alt: string;
}) {
  const [src, setSrc] = useState(primary);
  const [loaded, setLoaded] = useState(false);
  const [dead, setDead] = useState(false);
  const stage = useRef(0); // 0=primary, 1=retry, 2=retry2, 3=fallback, 4=dead
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const advance = () => {
    clearTimer();
    if (stage.current === 0) {
      stage.current = 1;
      setSrc(`${primary}${primary.includes('?') ? '&' : '?'}r=1`);
    } else if (stage.current === 1) {
      stage.current = 2;
      setSrc(`${primary}${primary.includes('?') ? '&' : '?'}r=2`);
    } else if (stage.current === 2 && fallback && fallback !== primary) {
      stage.current = 3;
      setSrc(fallback);
    } else {
      stage.current = 4;
      setDead(true);
    }
  };

  // src 가 바뀔 때마다 로드 타임아웃 재설정 (행 걸린 요청을 onError 없이도 복구)
  useEffect(() => {
    if (loaded || dead) return;
    timer.current = setTimeout(() => advance(), LOAD_TIMEOUT_MS);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, loaded, dead]);

  if (dead) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-600">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-zinc-800" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => {
          clearTimer();
          setLoaded(true);
        }}
        onError={advance}
      />
    </>
  );
}

function Bar({
  label,
  value,
  pct,
  color,
  hint,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-400" title={hint}>{label}</span>
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
