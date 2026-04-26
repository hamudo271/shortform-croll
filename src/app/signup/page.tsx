'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, PlusCircle } from '@/components/ui/Icon';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '회원가입에 실패했습니다'); return; }
      router.push('/account');
      router.refresh();
    } catch {
      setError('서버 연결에 실패했습니다');
    } finally { setLoading(false); }
  };

  const inputCls = 'w-full h-11 px-4 text-sm bg-background border border-zinc-700 rounded-xl text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-700">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-[-0.02em] text-zinc-50 hover:opacity-80 transition-opacity">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white text-sm font-bold shadow-sm">V</span>
            <span>바이럴 쇼츠</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] bg-zinc-950 border border-zinc-700 rounded-3xl p-8 sm:p-10 shadow-card">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white mb-4 shadow-sm">
              <PlusCircle size={26} strokeWidth={2} />
            </div>
            <h1 className="text-display text-2xl sm:text-3xl font-bold text-zinc-50 tracking-[-0.025em] mb-2">
              지금 무료로 시작하세요
            </h1>
            <p className="text-sm text-zinc-400">28일 구독 후 모든 기능 이용 가능 ✨</p>
          </div>

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
              <label className="block text-sm font-semibold text-zinc-100" htmlFor="name">
                이름 <span className="text-zinc-400 font-normal">(선택)</span>
              </label>
              <input
                id="name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="홍길동"
                autoComplete="name" maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-zinc-100" htmlFor="password">
                비밀번호 <span className="text-zinc-400 font-normal">(8자 이상)</span>
              </label>
              <input
                id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                required minLength={8} autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-zinc-100" htmlFor="password-confirm">비밀번호 확인</label>
              <input
                id="password-confirm" type="password" value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputCls}
                required minLength={8} autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-xl text-sm text-rose-700 dark:text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 h-11 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm"
            >
              {loading ? '가입 중...' : (<>가입하기 <ArrowRight size={14} /></>)}
            </button>

            <p className="text-center text-sm text-zinc-400 pt-2">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-blue-700 dark:text-blue-400 hover:underline underline-offset-4 font-semibold">
                로그인
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
