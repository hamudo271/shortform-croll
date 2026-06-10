import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';
import { getCurrentUser } from '@/lib/auth';

const MAX_IMAGE_LEN = 3_500_000;
const CATEGORIES = ['Fashion', 'Pet', 'Home', 'Beauty', 'Tech', 'Outdoor'];
const clampPct = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** GET /api/admin/products — 관리자 추가 상품 목록 (관리용). */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const items = await prisma.curatedProduct.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ products: items });
}

/** POST /api/admin/products — 상품 추가. */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const me = await getCurrentUser();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim().slice(0, 120);
  const description = String(body.description ?? '').trim().slice(0, 600);
  const category = CATEGORIES.includes(String(body.category)) ? String(body.category) : 'Home';
  const source = body.source ? String(body.source).trim().slice(0, 500) : null;
  const image = typeof body.image === 'string' ? body.image : '';

  if (!name || !description) {
    return NextResponse.json({ error: '상품명과 설명을 입력하세요.' }, { status: 400 });
  }
  if (!image || (image.length > MAX_IMAGE_LEN) || !/^data:image\/|^https?:\/\//.test(image)) {
    return NextResponse.json({ error: '이미지(2MB 이하)를 첨부하세요.' }, { status: 400 });
  }

  const product = await prisma.curatedProduct.create({
    data: {
      name,
      description,
      category,
      source,
      image,
      score: clampPct(body.score ?? 80),
      trend: clampPct(body.trend ?? 80),
      profit: clampPct(body.profit ?? 70),
      competition: clampPct(body.competition ?? 40),
      createdById: me?.id ?? null,
    },
  });

  return NextResponse.json({ id: product.id, success: true });
}
