import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

const MAX_IMAGE_LEN = 3_500_000;
const CATEGORIES = ['Fashion', 'Pet', 'Home', 'Beauty', 'Tech', 'Outdoor'];
const clampPct = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** DELETE /api/admin/products/[id] — 상품 삭제. */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  await prisma.curatedProduct.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}

/** PATCH /api/admin/products/[id] — 관리자 추가 상품 수정(부분 업데이트). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await context.params;

  const existing = await prisma.curatedProduct.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const data: Prisma.CuratedProductUpdateInput = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: '상품명을 입력하세요.' }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) {
    const description = String(body.description).trim().slice(0, 600);
    if (!description) return NextResponse.json({ error: '설명을 입력하세요.' }, { status: 400 });
    data.description = description;
  }
  if (body.category !== undefined && CATEGORIES.includes(String(body.category))) {
    data.category = String(body.category);
  }
  if (body.source !== undefined) {
    data.source = body.source ? String(body.source).trim().slice(0, 500) : null;
  }
  if (body.image !== undefined) {
    const image = typeof body.image === 'string' ? body.image : '';
    if (!image || image.length > MAX_IMAGE_LEN || !/^data:image\/|^https?:\/\//.test(image)) {
      return NextResponse.json({ error: '이미지(2MB 이하)가 올바르지 않습니다.' }, { status: 400 });
    }
    data.image = image;
  }
  for (const key of ['score', 'trend', 'profit', 'competition'] as const) {
    if (body[key] !== undefined) data[key] = clampPct(body[key]);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
  }

  await prisma.curatedProduct.update({ where: { id }, data });
  return NextResponse.json({ success: true });
}
