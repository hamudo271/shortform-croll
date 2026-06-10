import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

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
