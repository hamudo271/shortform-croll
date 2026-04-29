import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import {
  normalizeBusinessNumber,
  normalizeCompanyName,
  normalizeName,
  normalizePhone,
} from '@/lib/profile';

/**
 * Self-service profile updates by the logged-in user.
 *
 * Only allows safe profile fields — never email, password, role.
 * Email change requires re-verification (out of scope here); password
 * change has its own future endpoint.
 */
export async function PATCH(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

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

  const updated = await prisma.user.update({
    where: { id: session.id },
    data,
    select: {
      id: true, email: true, name: true,
      phone: true, companyName: true, businessNumber: true,
    },
  });

  void logActivity({
    userId: session.id,
    action: 'PROFILE_UPDATE',
    metadata: { fields: Object.keys(data) },
    request,
  });

  return NextResponse.json({ success: true, user: updated });
}
