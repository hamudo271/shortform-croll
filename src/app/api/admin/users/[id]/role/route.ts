import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * PATCH /api/admin/users/[id]/role { role: 'ADMIN' | 'USER' }
 * 관리자 임명/해제. 기존에는 ADMIN_EMAIL env + 재배포로만 가능했던 것을 UI에서 처리.
 * 안전장치: 자기 자신의 관리자 권한은 해제 불가(관리자 0명 사태 방지).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (body.role !== 'ADMIN' && body.role !== 'USER') {
    return NextResponse.json({ error: "role 은 'ADMIN' 또는 'USER' 여야 합니다." }, { status: 400 });
  }

  if (me.id === id && body.role !== 'ADMIN') {
    return NextResponse.json({ error: '자기 자신의 관리자 권한은 해제할 수 없습니다.' }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id }, data: { role: body.role } });
  } catch {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, role: body.role });
}
