import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/curated-products — 상품목록 페이지가 정적 SCOPE_PRODUCTS 와
 * 합쳐서 보여줄 '관리자 추가 상품'. 로그인 사용자 누구나 조회.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ products: [] });

  const items = await prisma.curatedProduct.findMany({ orderBy: { createdAt: 'desc' } });

  const products = items.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    source: p.source || '',
    image: p.image,
    score: p.score,
    trend: p.trend,
    profit: p.profit,
    competition: p.competition,
    tags: [
      p.category,
      p.trend > 82 ? 'High Demand' : 'Steady Demand',
      p.profit > 72 ? 'Good Margin' : 'Test First',
    ],
  }));

  const res = NextResponse.json({ products });
  res.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  return res;
}
