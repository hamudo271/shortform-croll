'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/app/PageHeader';
import { Search, PlusCircle, X } from '@/components/ui/Icon';
import { formatDate, daysUntil, getRelativeTime } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  phone: string | null;
  companyName: string | null;
  businessNumber: string | null; // already masked by API
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
  subscriptionCount: number;
  activityCount: number;
  lastActivityAt: string | null;
  subscription: {
    id: string;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELED';
    startAt: string;
    endAt: string;
    amount: number;
    memo: string | null;
    isActive: boolean;
  } | null;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setUsers(data.users);
    } catch { setError('사용자 목록을 불러오지 못했습니다'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubscribe = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation(); e.preventDefault();
    const memo = window.prompt('메모 (입금자명, 비워도 됨)', '');
    if (memo === null) return;
    setActingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: memo || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '활성화 실패'); return;
      }
      await load();
    } finally { setActingId(null); }
  };

  const handleCancel = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation(); e.preventDefault();
    if (!window.confirm('이 사용자의 구독을 취소하시겠습니까? (즉시 차단)')) return;
    setActingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '취소 실패'); return;
      }
      await load();
    } finally { setActingId(null); }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.companyName || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.subscription?.memo || '').toLowerCase().includes(q)
    );
  });

  const activeCount = users.filter((u) => u.subscription?.isActive).length;

  return (
    <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-10 space-y-8">
      <PageHeader title="관리자" accent="시스템" emoji="🛡️" />

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 회원', value: users.length, color: 'from-sky-400 to-blue-600' },
          { label: '활성 구독', value: activeCount, color: 'from-sky-400 to-blue-600' },
          { label: '미구독', value: users.length - activeCount, color: 'from-zinc-500 to-zinc-700' },
          { label: '예상 매출 (원)', value: (activeCount * 100000).toLocaleString(), color: 'from-amber-400 to-orange-600' },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 shadow-card">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} text-white text-xs font-bold mb-4 shadow-sm`}>
              {s.label.charAt(0)}
            </div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1.5">
              {s.label}
            </div>
            <div className="text-display text-2xl font-bold text-zinc-50 tracking-[-0.025em]">
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </div>
          </div>
        ))}
      </section>

      {/* Search + actions */}
      <section className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이메일·이름·회사명·전화·메모로 검색"
            className="w-full h-11 pl-10 pr-3.5 text-sm bg-background border border-zinc-700 rounded-xl text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
          />
        </div>
        <a
          href="/api/admin/users/export"
          className="inline-flex items-center justify-center h-11 px-4 text-sm font-semibold text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-colors"
        >
          CSV 내보내기
        </a>
      </section>

      {/* Users table */}
      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden shadow-card">
        {loading ? (
          <div className="p-16 text-center text-sm text-zinc-400">불러오는 중...</div>
        ) : error ? (
          <div className="p-16 text-center text-sm text-rose-700 dark:text-rose-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-sm text-zinc-400">사용자가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900 border-b border-zinc-700">
                <tr className="text-xs text-zinc-400 uppercase tracking-wider">
                  <th className="text-left px-6 py-4 font-semibold">사용자</th>
                  <th className="text-left px-6 py-4 font-semibold">권한</th>
                  <th className="text-left px-6 py-4 font-semibold">구독</th>
                  <th className="text-left px-6 py-4 font-semibold">만료</th>
                  <th className="text-left px-6 py-4 font-semibold">메모</th>
                  <th className="text-left px-6 py-4 font-semibold">마지막 접속</th>
                  <th className="text-left px-6 py-4 font-semibold">가입</th>
                  <th className="text-right px-6 py-4 font-semibold">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {filtered.map((u) => {
                  const isActive = !!u.subscription?.isActive;
                  const remaining = u.subscription ? daysUntil(u.subscription.endAt) : null;
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-zinc-900 transition-colors cursor-pointer"
                      onClick={() => { window.location.href = `/admin/users/${u.id}`; }}
                    >
                      <td className="px-6 py-5">
                        <div className="text-zinc-50 font-semibold tracking-tight">{u.name || '-'}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{u.email}</div>
                        {u.companyName && (
                          <div className="text-xs text-zinc-500 mt-0.5">{u.companyName}</div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 text-xs font-semibold">
                            관리자
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">회원</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        {!u.subscription ? (
                          <span className="text-xs text-zinc-400">미구독</span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            활성 ({remaining}일)
                          </span>
                        ) : u.subscription.status === 'EXPIRED' ? (
                          <span className="text-xs text-zinc-400">만료</span>
                        ) : u.subscription.status === 'CANCELED' ? (
                          <span className="text-xs text-zinc-400">취소</span>
                        ) : (
                          <span className="text-xs text-zinc-400">{u.subscription.status}</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-zinc-300 text-xs">
                        {formatDate(u.subscription?.endAt ?? null)}
                      </td>
                      <td className="px-6 py-5 text-zinc-400 text-xs max-w-[180px] truncate">
                        {u.subscription?.memo || '-'}
                      </td>
                      <td className="px-6 py-5 text-zinc-400 text-xs">
                        {u.lastLoginAt ? getRelativeTime(u.lastLoginAt) : '-'}
                        {u.loginCount > 0 && (
                          <span className="ml-1 text-zinc-500">· {u.loginCount}회</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-zinc-400 text-xs">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/admin/users/${u.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-3 h-9 text-xs font-medium text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            상세
                          </Link>
                          <button
                            onClick={(e) => handleSubscribe(e, u.id)}
                            disabled={actingId === u.id}
                            className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap shadow-sm"
                          >
                            <PlusCircle size={12} strokeWidth={2.25} />
                            {isActive ? '+28일' : '활성화'}
                          </button>
                          {isActive && (
                            <button
                              onClick={(e) => handleCancel(e, u.id)}
                              disabled={actingId === u.id}
                              className="inline-flex items-center gap-1 px-3 h-9 text-xs font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <X size={12} />
                              취소
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
