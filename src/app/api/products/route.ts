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
 *  - Competition 은 "콘텐츠 포화도(베타)" 라벨로 추정 표시.
 *
 * Query params:
 *  - days (default 30)
 *  - limit (default 50, max 100)
 *  - passReason: 'both' | 'all'  (default 'both')
 *  - category (optional)
 *  - search (optional, title contains)
 */

/** 영상 캡션을 상품 제목 후보로 정제. 해시태그/이모지 노이즈 제거 + 길이 트림. */
function cleanProductTitle(raw: string): string {
  let t = raw || '';
  // 해시태그 제거
  t = t.replace(/#\S+/g, ' ');
  // 멘션 제거
  t = t.replace(/@\S+/g, ' ');
  // URL 제거
  t = t.replace(/https?:\/\/\S+/g, ' ');
  // 연속 공백 정리
  t = t.replace(/\s+/g, ' ').trim();
  // 너무 길면 첫 문장 또는 80자 컷
  const sentenceEnd = t.search(/[.!?。！？]/);
  if (sentenceEnd > 20 && sentenceEnd < 100) {
    t = t.slice(0, sentenceEnd + 1).trim();
  } else if (t.length > 80) {
    t = t.slice(0, 80).trim() + '…';
  }
  return t;
}

/** TikTok 썸네일은 CDN signed URL 이 만료됨 → 프록시 경유. */
function resolveImageUrl(platform: string, thumbnailUrl: string, videoUrl: string): string {
  if (platform === 'TIKTOK' && videoUrl) {
    return `/api/thumbnail/tiktok?url=${encodeURIComponent(videoUrl)}`;
  }
  return thumbnailUrl;
}

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

    const overfetch = limit * 3;
    const rawVideos = await prisma.video.findMany({
      where,
      orderBy: { viralScore: 'desc' },
      take: overfetch,
    });

    const filtered = rawVideos.filter(
      (v) => !isExcludedContent(v.title, v.authorName),
    );

    // 카테고리별 출현 빈도 — 콘텐츠 포화도(베타) 산출용
    const catCount = new Map<string, number>();
    for (const v of filtered) {
      const key = v.category || 'OTHER';
      catCount.set(key, (catCount.get(key) || 0) + 1);
    }
    const uniqueCats = catCount.size;
    const maxCatCount = Math.max(1, ...catCount.values());

    const products = filtered.slice(0, limit).map((v) => {
      const viewCount = Number(v.viewCount);
      const commentCount = Number(v.commentCount);
      const intentRate = v.purchaseIntentScore || 0;

      // DPM 재계산 — DPM=100 이면 만점(10).
      const dpm = computeDemandPerMillion(intentRate, commentCount, viewCount);
      const marketDemand = Math.max(0, Math.min(10, dpm / 10));

      // 콘텐츠 포화도(베타):
      //  - 카테고리 다양성이 1종뿐이면 비교가 의미 없음 → 중립값 5.0
      //  - 그 외에는 같은 카테고리 후보 수의 로그 정규화
      let competition = 5.0;
      if (uniqueCats > 1) {
        const c = catCount.get(v.category || 'OTHER') || 1;
        const saturation = Math.log10(c + 1) / Math.log10(maxCatCount + 1);
        competition = Math.max(0, Math.min(10, saturation * 10));
      }

      const cleanedTitle = cleanProductTitle(v.title);
      const cleanedDesc = (v.description || '').trim();
      // 설명이 제목과 같거나 너무 길면 숨김
      const descShown =
        cleanedDesc && cleanedDesc !== v.title && cleanedDesc.length < 280
          ? cleanedDesc
          : '';

      return {
        id: v.id,
        videoId: v.videoId,
        platform: v.platform,
        title: cleanedTitle || v.authorName || 'Untitled product',
        desc: descShown,
        image: resolveImageUrl(v.platform, v.thumbnailUrl, v.videoUrl),
        thumbnailRaw: v.thumbnailUrl, // 프록시 실패 시 클라이언트 폴백용 원본 URL
        authorName: v.authorName,
        category: v.category,
        keywords: (v.tags || []).slice(0, 8),
        links: [
          {
            label: 'Source',
            href: v.videoUrl,
          },
        ],
        marketDemand: Math.round(marketDemand * 10) / 10,
        competition: Math.round(competition * 10) / 10,
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
        uniqueCategories: uniqueCats,
        notes: {
          marketDemand: 'DPM(purchase-per-million) 재계산 후 0-10 (DPM=100 만점)',
          competition:
            '콘텐츠 포화도(베타) — 같은 카테고리 후보 수 로그 정규화. 카테고리 1종이면 5.0 중립',
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
