'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/app/PageHeader';

interface CuratedProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  source: string | null;
  image: string;
  score: number;
  trend: number;
  profit: number;
  competition: number;
  createdAt: string;
}

const CATEGORIES = ['Fashion', 'Pet', 'Home', 'Beauty', 'Tech', 'Outdoor'];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<CuratedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Home');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [image, setImage] = useState('');
  const [score, setScore] = useState(85);
  const [trend, setTrend] = useState(85);
  const [profit, setProfit] = useState(75);
  const [competition, setCompetition] = useState(40);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/products');
    if (r.ok) setProducts((await r.json()).products || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('이미지 파일만 가능합니다.');
    if (file.size > 2_000_000) return setErr('이미지는 2MB 이하만 가능합니다.');
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!name.trim() || !description.trim()) return setErr('상품명과 설명을 입력하세요.');
    if (!image) return setErr('이미지를 첨부하세요.');
    setSaving(true);
    try {
      const r = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, description, source, image, score, trend, profit, competition }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '저장 실패');
      setOk('상품이 추가되었습니다.');
      setName('');
      setDescription('');
      setSource('');
      setImage('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 상품을 삭제할까요?')) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="max-w-[960px] mx-auto px-6 sm:px-10 py-10">
      <PageHeader title="상품 관리" accent="관리자" description="상품 목록 DB에 직접 상품을 추가/삭제합니다. 추가한 상품은 기존 큐레이션 상품과 함께 노출됩니다.">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-100">← 관리자</Link>
      </PageHeader>

      <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
        {/* 추가 폼 */}
        <form onSubmit={submit} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
          <h3 className="text-sm font-bold text-zinc-50">새 상품 추가</h3>

          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">이미지</span>
            <div className="mt-1 flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg border border-zinc-700 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-zinc-400">미리보기</span>
                )}
              </div>
              <label className="text-xs text-blue-500 cursor-pointer hover:text-blue-400">
                파일 선택 (2MB↓)
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
              </label>
            </div>
          </label>

          <Field label="상품명">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputCls} placeholder="예: 미니 전동 청소기" />
          </Field>
          <Field label="카테고리">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="설명">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={3} className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none" placeholder="제품 설명 / 콘텐츠 포인트" />
          </Field>
          <Field label="원본 링크 (선택)">
            <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} className={inputCls} placeholder="https://instagram.com/reel/..." />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Slider label="Score" value={score} onChange={setScore} />
            <Slider label="Trend" value={trend} onChange={setTrend} />
            <Slider label="Profit" value={profit} onChange={setProfit} />
            <Slider label="Comp." value={competition} onChange={setCompetition} />
          </div>

          {err && <p className="text-xs text-rose-500">{err}</p>}
          {ok && <p className="text-xs text-emerald-500">{ok}</p>}
          <button type="submit" disabled={saving} className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {saving ? '저장 중…' : '상품 추가'}
          </button>
        </form>

        {/* 목록 */}
        <div className="space-y-3">
          <div className="text-sm text-zinc-400">관리자 추가 상품 <b className="text-zinc-100">{products.length}</b>개</div>
          {loading ? (
            <div className="py-10 text-center text-sm text-zinc-500">불러오는 중…</div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 py-10 text-center text-sm text-zinc-500">아직 추가한 상품이 없습니다.</div>
          ) : (
            products.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="w-16 h-16 rounded-lg border border-zinc-800 bg-white overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-zinc-50 truncate">{p.name}</h4>
                    <button onClick={() => remove(p.id)} className="text-xs text-rose-500 hover:text-rose-400 shrink-0">삭제</button>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{p.category} · Score {p.score} · Trend {p.trend} · Profit {p.profit}</div>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{p.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full mt-1 h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] font-semibold text-zinc-500">
        {label} <b className="text-zinc-300 tabular-nums">{value}</b>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full mt-1 accent-blue-600" />
    </label>
  );
}
