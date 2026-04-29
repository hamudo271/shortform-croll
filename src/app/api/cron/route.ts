import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Cron API - 매일 자동 실행
 * 1. 30일 지난 데이터 삭제
 * 2. 한글 영상 자동 정리 (해외 풀 전환 후)
 * 3. 해외 바이럴 상품 영상 수집 트리거
 *
 * Railway Cron 또는 외부 cron 서비스(cron-job.org)에서 호출
 * GET /api/cron?key=COLLECT_API_KEY
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const expectedKey = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    deletedOld: 0,
    deletedKorean: 0,
    collected: 0,
    errors: [] as string[],
  };

  try {
    // Step 1: 30일 지난 데이터 삭제
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleteOld = await prisma.video.deleteMany({
      where: { collectedAt: { lt: thirtyDaysAgo } },
    });
    results.deletedOld = deleteOld.count;

    // Step 2: 한글 들어간 영상 삭제 (해외 풀 전환에 따른 정리)
    const allVideos = await prisma.video.findMany({
      select: { id: true, title: true, description: true },
    });
    const koreanIds = allVideos
      .filter(v => /[가-힣]/.test(v.title) || /[가-힣]/.test(v.description || ''))
      .map(v => v.id);

    if (koreanIds.length > 0) {
      const deleteKR = await prisma.video.deleteMany({
        where: { id: { in: koreanIds } },
      });
      results.deletedKorean = deleteKR.count;
    }

    // Step 3: 해외 바이럴 상품 영상 수집 (US 기본)
    try {
      const origin = request.nextUrl.origin;
      const token = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

      const collectRes = await fetch(`${origin}/api/collect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // body 비우면 collect/route.ts가 기본 geo='US' 사용
        body: '{}',
      });

      if (collectRes.ok) {
        const data = await collectRes.json();
        results.collected = data.results?.videosCollected || 0;
      } else {
        results.errors.push('Collection failed: ' + collectRes.statusText);
      }
    } catch (err) {
      results.errors.push('Collection error: ' + String(err));
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: String(error) },
      { status: 500 }
    );
  }
}
