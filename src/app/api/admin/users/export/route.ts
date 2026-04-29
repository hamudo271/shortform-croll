import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

/**
 * Admin: CSV export of all members.
 *
 * Includes a UTF-8 BOM so Excel renders Korean correctly when opened
 * directly. Each row escapes embedded quotes/commas/newlines.
 */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmt(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString();
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscriptions: { orderBy: { endAt: 'desc' }, take: 1 },
    },
  });

  const headers = [
    'ID',
    '이메일',
    '이름',
    '권한',
    '회사명',
    '전화번호',
    '사업자번호',
    '가입일',
    '마지막로그인',
    '로그인횟수',
    '구독상태',
    '구독만료일',
    '구독금액',
    '메모',
  ];

  const rows = users.map((u) => {
    const sub = u.subscriptions[0] ?? null;
    return [
      u.id,
      u.email,
      u.name ?? '',
      u.role,
      u.companyName ?? '',
      u.phone ?? '',
      u.businessNumber ?? '',
      fmt(u.createdAt),
      fmt(u.lastLoginAt),
      u.loginCount,
      sub?.status ?? '',
      fmt(sub?.endAt),
      sub?.amount ?? '',
      sub?.memo ?? '',
    ].map(csvEscape).join(',');
  });

  const body = '﻿' + [headers.join(','), ...rows].join('\r\n');

  const filename = `members-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
