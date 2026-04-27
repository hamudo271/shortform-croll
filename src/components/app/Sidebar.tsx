'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ChevronRight,
  TrendingUp,
  Layers,
  Search,
  Eye,
  User,
  LogOut,
  Shield,
  Sun,
  Moon,
} from '@/components/ui/Icon';

type Badge = { label: string; tone: 'green' | 'yellow' | 'blue' | 'gray' };

interface NavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  badge?: Badge;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  badge?: Badge;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: '쇼핑 트렌드',
    badge: { label: '핵심', tone: 'green' },
    items: [
      { href: '/dashboard/tiktok', label: '틱톡 인기 상품', icon: TrendingUp },
      { href: '/dashboard/instagram', label: '인스타 인기 상품', icon: TrendingUp },
    ],
  },
  {
    label: '추가 채널',
    items: [
      { href: '/dashboard', label: '전체 대시보드', icon: TrendingUp, exact: true },
      { href: '/dashboard/youtube', label: '유튜브 쇼츠' },
    ],
  },
  {
    label: '탐색',
    badge: { label: '구독 필요', tone: 'gray' },
    items: [
      { href: '/dashboard/categories', label: '카테고리별', icon: Layers },
      { href: '/dashboard/search', label: '키워드 검색', icon: Search },
    ],
  },
  {
    label: '분석',
    badge: { label: '구독 필요', tone: 'gray' },
    items: [
      { href: '/dashboard/top', label: 'Top 바이럴', icon: Eye },
    ],
  },
];

interface UserShape {
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  hasActiveSubscription: boolean;
}

interface Props {
  user: UserShape | null;
}

const BADGE_STYLES: Record<Badge['tone'], string> = {
  green: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  blue: 'bg-sky-50 text-blue-700 border-sky-200 dark:bg-sky-500/10 dark:text-blue-400 dark:border-sky-500/30',
  gray: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

function readInitialCollapsed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c === 'sidebar=collapsed');
}

function readInitialTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(readInitialCollapsed());
    setTheme(readInitialTheme());
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar=${next ? 'collapsed' : 'expanded'}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    const html = document.documentElement;
    if (next === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    document.cookie = `theme=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname?.startsWith(item.href + '/');
  };

  return (
    <aside
      className={`shrink-0 sticky top-0 h-screen bg-sidebar border-r border-zinc-700 flex flex-col transition-[width] duration-200 ease-out ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top — logo + collapse toggle */}
      <div className="h-16 px-3 flex items-center justify-between border-b border-zinc-700 shrink-0">
        <Link href="/" className="flex items-center gap-2 min-w-0 group">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shrink-0 shadow-sm">
            <span className="text-base font-bold">S</span>
          </span>
          {!collapsed && (
            <span className="text-display text-base font-bold tracking-[-0.02em] text-zinc-50 truncate group-hover:opacity-80 transition-opacity">
              스마트렌드
            </span>
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors ${collapsed ? 'rotate-180' : ''}`}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {NAV.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="flex items-center gap-2 px-3 mb-2">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em]">
                  {group.label}
                </span>
                {group.badge && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border ${BADGE_STYLES[group.badge.tone]}`}>
                    {group.badge.label}
                  </span>
                )}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-500/10 dark:text-blue-400'
                          : 'text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      {Icon ? <Icon size={16} className="shrink-0" /> : <span className="w-4 shrink-0" />}
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className={`ml-auto px-1.5 py-0.5 text-[9px] font-semibold rounded border ${BADGE_STYLES[item.badge.tone]}`}>
                              {item.badge.label}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom — theme toggle + admin + user */}
      <div className="border-t border-zinc-700 p-3 space-y-2 shrink-0">
        <button
          onClick={toggleTheme}
          suppressHydrationWarning
          className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
        >
          {mounted && theme === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          {!collapsed && <span>{mounted && theme === 'dark' ? '라이트 모드' : '다크 모드'}</span>}
        </button>

        {user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
            title="관리자"
          >
            <Shield size={16} className="shrink-0" />
            {!collapsed && <span>관리자</span>}
          </Link>
        )}

        {user ? (
          <>
            <Link
              href="/account"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-zinc-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
              title={user.email}
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold shrink-0">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-zinc-50 font-medium truncate">{user.name || user.email}</div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {user.hasActiveSubscription ? '구독 활성' : '미구독'}
                  </div>
                </div>
              )}
            </Link>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut size={16} className="shrink-0" />
              {!collapsed && <span>로그아웃</span>}
            </button>
          </>
        ) : (
          <>
            {!collapsed && (
              <div className="px-3 py-3 rounded-lg bg-zinc-800 mb-2">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-700 text-zinc-400 shrink-0">
                    <User size={14} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-zinc-50 text-sm font-semibold">로그인이 필요합니다</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">서비스를 이용하려면 로그인하세요</div>
                  </div>
                </div>
              </div>
            )}
            <Link
              href="/login"
              className={`flex items-center justify-center gap-2 w-full h-10 text-sm font-semibold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-lg transition-all shadow-sm ${collapsed ? 'px-0' : 'px-3'}`}
            >
              <User size={16} className="shrink-0" />
              {!collapsed && <span>로그인</span>}
            </Link>
            <Link
              href="/signup"
              className={`flex items-center justify-center gap-2 w-full h-10 text-sm font-semibold text-zinc-100 border border-zinc-700 hover:bg-zinc-800 rounded-lg transition-colors ${collapsed ? 'px-0' : 'px-3'}`}
            >
              {collapsed ? <ChevronRight size={16} /> : <span>회원가입</span>}
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
