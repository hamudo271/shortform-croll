'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/app/PageHeader';
import { ChevronRight, PlusCircle, X, User as UserIcon, Mail, Shield, Clock, Smartphone } from '@/components/ui/Icon';
import { formatDate, getRelativeTime, daysUntil } from '@/lib/utils';

type SubStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED';

interface SubscriptionRow {
  id: string;
  status: SubStatus;
  startAt: string;
  endAt: string;
  amount: number;
  memo: string | null;
  createdAt: string;
}

interface ActivityRow {
  id: string;
  action: string;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AdminUserDetail {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  phone: string | null;
  companyName: string | null;
  businessNumber: string | null;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  subscriptions: SubscriptionRow[];
  activityLogs: ActivityRow[];
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  // Editable profile state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editBizNum, setEditBizNum] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setUser(data.user);
      setEditName(data.user.name ?? '');
      setEditPhone(data.user.phone ?? '');
      setEditCompany(data.user.companyName ?? '');
      setEditBizNum(data.user.businessNumber ?? '');
    } catch { setError('회원 정보를 불러오지 못했습니다'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSubscribe = async () => {
    const memo = window.prompt('메모 (입금자명, 비워도 됨)', '');
    if (memo === null) return;
    setActing(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: memo || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '활성화 실패'); return;
      }
      await load();
    } finally { setActing(false); }
  };

  const handleCancel = async () => {
    if (!window.confirm('이 사용자의 구독을 취소하시겠습니까? (즉시 차단)')) return;
    setActing(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '취소 실패'); return;
      }
      await load();
    } finally { setActing(false); }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true); setProfileMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/profile`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName, phone: editPhone,
          companyName: editCompany, businessNumber: editBizNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setProfileMsg(data.error || '저장 실패'); return; }
      setProfileMsg('저장되었습니다');
      await load();
    } finally { setProfileSaving(false); }
  };

  if (loading) {
    return <div className="max-w-[1200px] mx-auto px-6 py-16 text-center text-sm text-zinc-400">불러오는 중...</div>;
  }
  if (error || !user) {
    return <div className="max-w-[1200px] mx-auto px-6 py-16 text-center text-sm text-rose-400">{error || '회원을 찾을 수 없습니다'}</div>;
  }

  const remaining = user.subscriptions[0] ? daysUntil(user.subscriptions[0].endAt) : null;
  const inputCls = 'w-full h-10 px-3 text-sm bg-background border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all';

  return (
    <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-zinc-400 flex items-center gap-1.5">
        <Link href="/admin" className="hover:text-zinc-100">관리자</Link>
        <ChevronRight size={12} />
        <span className="text-zinc-300">{user.name || user.email}</span>
      </nav>

      <PageHeader title={user.name || user.email} accent="회원 상세" emoji="👤" />

      {/* Section 1: 기본 정보 */}
      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 sm:p-8 shadow-card">
        <h2 className="text-sm font-semibold text-zinc-50 tracking-tight mb-5 flex items-center gap-2">
          <UserIcon size={16} className="text-blue-400" /> 기본 정보
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field icon={<Mail size={13} />} label="이메일" value={user.email} />
          <Field icon={<Shield size={13} />} label="권한" value={user.role === 'ADMIN' ? '관리자' : '회원'} />
          <Field icon={<Clock size={13} />} label="가입일" value={formatDate(user.createdAt)} />
          <Field icon={<Clock size={13} />} label="마지막 로그인" value={user.lastLoginAt ? `${getRelativeTime(user.lastLoginAt)} (${formatDate(user.lastLoginAt)})` : '-'} />
          <Field icon={<Clock size={13} />} label="누적 로그인" value={`${user.loginCount.toLocaleString()}회`} />
          <Field icon={<Clock size={13} />} label="활동 로그" value={`${user.activityLogs.length.toLocaleString()}건 (최근 50)`} />
        </dl>
      </section>

      {/* Section 2: 연락처/사업자 정보 (편집 가능) */}
      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 sm:p-8 shadow-card">
        <h2 className="text-sm font-semibold text-zinc-50 tracking-tight mb-5 flex items-center gap-2">
          <Smartphone size={16} className="text-blue-400" /> 연락처 / 사업자 정보
        </h2>
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-zinc-300">이름</span>
            <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} />
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-zinc-300">전화번호</span>
            <input className={inputCls} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="010-1234-5678" maxLength={20} />
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-zinc-300">회사명</span>
            <input className={inputCls} value={editCompany} onChange={(e) => setEditCompany(e.target.value)} maxLength={100} />
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-zinc-300">사업자등록번호</span>
            <input className={inputCls} value={editBizNum} onChange={(e) => setEditBizNum(e.target.value)} placeholder="123-45-67890" inputMode="numeric" maxLength={12} />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3 pt-2">
            <button type="submit" disabled={profileSaving} className="inline-flex items-center px-4 h-10 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg disabled:opacity-50 transition-all">
              {profileSaving ? '저장 중...' : '저장'}
            </button>
            {profileMsg && <span className="text-xs text-zinc-300">{profileMsg}</span>}
          </div>
        </form>
      </section>

      {/* Section 3: 결제/구독 이력 */}
      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 sm:p-8 shadow-card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-zinc-50 tracking-tight">결제 / 구독 이력</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleSubscribe} disabled={acting} className="inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg disabled:opacity-50 shadow-sm transition-all">
              <PlusCircle size={12} strokeWidth={2.25} />
              {user.isActive ? `+28일 (남은 ${remaining}일)` : '구독 활성화'}
            </button>
            {user.isActive && (
              <button onClick={handleCancel} disabled={acting} className="inline-flex items-center gap-1 px-3 h-9 text-xs font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg disabled:opacity-50 transition-colors">
                <X size={12} /> 취소
              </button>
            )}
          </div>
        </div>
        {user.subscriptions.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">구독 이력이 없습니다</div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-2 py-2 font-semibold">시작</th>
                  <th className="text-left px-2 py-2 font-semibold">만료</th>
                  <th className="text-left px-2 py-2 font-semibold">상태</th>
                  <th className="text-right px-2 py-2 font-semibold">금액</th>
                  <th className="text-left px-2 py-2 font-semibold">메모</th>
                  <th className="text-left px-2 py-2 font-semibold">생성</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {user.subscriptions.map((s) => (
                  <tr key={s.id} className="text-zinc-200">
                    <td className="px-2 py-3 text-xs">{formatDate(s.startAt)}</td>
                    <td className="px-2 py-3 text-xs">{formatDate(s.endAt)}</td>
                    <td className="px-2 py-3"><StatusPill status={s.status} /></td>
                    <td className="px-2 py-3 text-xs text-right tabular-nums">{s.amount.toLocaleString()}원</td>
                    <td className="px-2 py-3 text-xs text-zinc-400 max-w-[240px] truncate">{s.memo || '-'}</td>
                    <td className="px-2 py-3 text-xs text-zinc-500">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 4: 활동 로그 */}
      <section className="bg-zinc-950 border border-zinc-700 rounded-2xl p-6 sm:p-8 shadow-card">
        <h2 className="text-sm font-semibold text-zinc-50 tracking-tight mb-5">최근 활동 로그</h2>
        {user.activityLogs.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">활동 기록이 없습니다</div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-2 py-2 font-semibold">시각</th>
                  <th className="text-left px-2 py-2 font-semibold">동작</th>
                  <th className="text-left px-2 py-2 font-semibold">IP</th>
                  <th className="text-left px-2 py-2 font-semibold">메타</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {user.activityLogs.map((a) => (
                  <tr key={a.id} className="text-zinc-200">
                    <td className="px-2 py-3 text-xs whitespace-nowrap">
                      {getRelativeTime(a.createdAt)}
                      <div className="text-[10px] text-zinc-500">{formatDate(a.createdAt)}</div>
                    </td>
                    <td className="px-2 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 text-[11px] font-semibold">{a.action}</span>
                    </td>
                    <td className="px-2 py-3 text-xs text-zinc-400 font-mono">{a.ipAddress || '-'}</td>
                    <td className="px-2 py-3 text-xs text-zinc-500 max-w-[360px] truncate font-mono">
                      {a.metadata ? JSON.stringify(a.metadata) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-400 font-semibold mb-1 flex items-center gap-1.5">
        <span className="text-zinc-500">{icon}</span>
        {label}
      </dt>
      <dd className="text-sm text-zinc-100 tracking-tight">{value || '-'}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: SubStatus }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> 활성
      </span>
    );
  }
  if (status === 'EXPIRED') {
    return <span className="text-xs text-zinc-400">만료</span>;
  }
  return <span className="text-xs text-zinc-400">취소</span>;
}
