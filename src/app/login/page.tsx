'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, User } from '@/components/ui/Icon';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '로그인에 실패했습니다'); return; }
      router.push(next);
      router.refresh();
    } catch {
      setError('서버 연결에 실패했습니다');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full h-11 px-4 text-sm bg-background border border-zinc-700 rounded-xl text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-zinc-100" htmlFor="email">이메일</label>
        <input
          id="email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="email@example.com"
          required autoFocus autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-zinc-100" htmlFor="password">비밀번호</label>
        <input
          id="password" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
          required autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-xl text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 h-11 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 rounded-xl transition-all shadow-sm"
      >
        {loading ? '로그인 중...' : (<>로그인 <ArrowRight size={14} /></>)}
      </button>

      <p className="text-center text-sm text-zinc-400 pt-2">
        계정이 없으신가요?{' '}
        <Link href="/signup" className="text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-4 font-semibold">
          회원가입
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-700">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-[-0.02em] text-zinc-50 hover:opacity-80 transition-opacity">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-bold shadow-sm">V</span>
            <span>바이럴 쇼츠</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] bg-zinc-950 border border-zinc-700 rounded-3xl p-8 sm:p-10 shadow-card">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white mb-4 shadow-sm">
              <User size={24} strokeWidth={2.25} />
            </div>
            <h1 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 tracking-[-0.025em] mb-2">
              로그인
            </h1>
            <p className="text-sm text-zinc-400">계속하려면 계정 정보를 입력하세요.</p>
          </div>
          <Suspense fallback={<div className="text-sm text-zinc-400 text-center">로딩 중...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
