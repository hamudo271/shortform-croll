import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Category } from '@prisma/client';
import { isExcludedContent } from '@/lib/exclude';
import { computeDemandPerMillion } from '@/lib/comments';

/**
 * /api/products — 상품 목록 DB 페이지 전용 응답.
 *
 * 현재 단계(MVP):
 *  - 독립 Product 모델은 만들지 않고, Video 에서 파생.
 *  - 기본 passReason='both' 만 노출 (가장 강한 buyer-intent 신호).
 *  - DPM 은 Video 에 저장돼 있지 않으므로 응답 단계에서
 *    purchaseIntentScore / commentCount / viewCount 로 재계산.
 *  - Profit Margin 은 데이터 없음 → 응답에서 제외, UI 에서도 숨김.
 *  - Competition 은 "콘텐츠 포화도(베타)" 라벨로 추정 표시 — 같은 카테고리
 *    내 상품 후보 수의 로그 정규화.
 *
 * Query params:
 *  - days (default 30)
 *  - limit (default 50, max 100)
 *  - passReason: 'both' | 'all'  (default 'both')
 *      both = passReason='both' 만
 *      all  = passReason in ('both','creator_link') — IG creator_link 포함
 *  - category (optional)
 *  - search (optional, title contains)
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const days = Math.max(1, Math.min(365, parseInt(sp.get('days') || '30', 10)));
    const limit = Math.max(1, Math.min(100, parseInt(sp.get('limit') || '50', 10)));
    const passReasonParam = (sp.get('passReason') || 'both') as 'both' | 'all';
    const category = sp.get('category') as Category | null;
    const search = sp.get('search')?.trim() || null;

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const MIN_PUBLISHED_AT = new Date('2025-12-01T00:00:00Z');

    const passReasonFilter =
      passReasonParam === 'all'
        ? { in: ['both', 'creator_link'] as string[] }
        : 'both';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      passReason: passReasonFilter,
      collectedAt: { gte: dateThreshold },
      publishedAt: { gte: MIN_PUBLISHED_AT },
      ...(category && { category }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };

    // Overfetch — 응답 단계 exclude 필터 보정용
    const overfetch = limit * 3;
    const rawVideos = await prisma.video.findMany({
      where,
      orderBy: { viralScore: 'desc' },
      take: overfetch,
    });

    const filtered = rawVideos.filter(
      (v) => !isExcludedContent(v.title, v.authorName),
    );

    // 카테고리별 출현 빈도 — Competition(콘텐츠 포화도 베타) 산출용
    const catCount = new Map<string, number>();
    for (const v of filtered) {
      const key = v.category || 'OTHER';
      catCount.set(key, (catCount.get(key) || 0) + 1);
    }
    const maxCatCount = Math.max(1, ...catCount.values());

    const products = filtered.slice(0, limit).map((v) => {
      const viewCount = Number(v.viewCount);
      const commentCount = Number(v.commentCount);
      const intentRate = v.purchaseIntentScore || 0;

      // DPM 재계산 (lib/comments.computeDemandPerMillion 와 동일 식)
      const dpm = computeDemandPerMillion(intentRate, commentCount, viewCount);

      // Market Demand: DPM 기반 0–10 정규화. DPM=50 이상이면 만점.
      const marketDemand = Math.max(0, Math.min(10, dpm / 5));

      // 콘텐츠 포화도(베타): 같은 카테고리 내 후보 수의 로그 정규화.
      // 상품 후보가 많이 쌓인 카테고리일수록 경쟁이 심하다고 가정.
      const c = catCount.get(v.category || 'OTHER') || 1;
      const saturation =
        Math.log10(c + 1) / Math.log10(maxCatCount + 1);
      const competition = Math.max(0, Math.min(10, saturation * 10));

      return {
        id: v.id,
        videoId: v.videoId,
        platform: v.platform,
        title: v.title,
        desc: v.description || '',
        image: v.thumbnailUrl,
        authorName: v.authorName,
        category: v.category,
        keywords: v.tags || [],
        links: [
          {
            label: 'Source',
            href: v.videoUrl,
          },
        ],
        // 0-10 점수
        marketDemand: Math.round(marketDemand * 10) / 10,
        competition: Math.round(competition * 10) / 10,
        // 메타
        viewCount,
        commentCount,
        purchaseIntentScore: intentRate,
        passReason: v.passReason,
        publishedAt: v.publishedAt,
      };
    });

    const res = NextResponse.json({
      products,
      total: filtered.length,
      meta: {
        passReason: passReasonParam,
        days,
        limit,
        notes: {
          marketDemand: 'DPM (purchase-per-million) 재계산 후 0-10 정규화',
          competition: '콘텐츠 포화도(베타) — 같은 카테고리 내 후보 수의 로그 정규화',
          profitMargin: '데이터 없음 — UI 노출 안 함',
        },
      },
    });
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
