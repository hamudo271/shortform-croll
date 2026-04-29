import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';
import {
  normalizeBusinessNumber,
  normalizeCompanyName,
  normalizeName,
  normalizePhone,
} from '@/lib/profile';

/**
 * Admin-edit of a member's profile fields.
 * Mirrors /api/account/profile but bypasses the self-only constraint.
 * Cannot change email/password/role here — separate endpoints.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  try {
    if ('name' in body) data.name = normalizeName(body.name);
    if ('phone' in body) data.phone = normalizePhone(body.phone);
    if ('companyName' in body) data.companyName = normalizeCompanyName(body.companyName);
    if ('businessNumber' in body) data.businessNumber = normalizeBusinessNumber(body.businessNumber);
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    if (code === 'INVALID_PHONE') {
      return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다' }, { status: 400 });
    }
    if (code === 'INVALID_BUSINESS_NUMBER') {
      return NextResponse.json({ error: '사업자등록번호는 10자리 숫자여야 합니다' }, { status: 400 });
    }
    throw e;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, email: true, name: true,
      phone: true, companyName: true, businessNumber: true,
    },
  });

  return NextResponse.json({ success: true, user: updated });
}
