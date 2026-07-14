import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

/**
 * 관리자 영상 관리 — 게이트를 뚫고 들어온 부적합 영상(밈/얼굴캠 등) 처리.
 * PATCH { hidden: boolean } = 숨김/해제 (데이터 보존, 표시 API 에서만 제외)
 * DELETE = 완전 삭제 (재수집되면 다시 들어올 수 있음 — 보통은 숨김 권장)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  let body: { hidden?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (typeof body.hidden !== 'boolean') {
    return NextResponse.json({ error: 'hidden(boolean)이 필요합니다.' }, { status: 400 });
  }

  try {
    await prisma.video.update({ where: { id }, data: { hidden: body.hidden } });
  } catch {
    return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, hidden: body.hidden });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  try {
    await prisma.video.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
