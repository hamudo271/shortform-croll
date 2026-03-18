import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Cron API - 매일 자동 실행
 * 1. 30일 지난 데이터 삭제
 * 2. 한국 바이럴 영상 수집 트리거
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
    deletedNonKorean: 0,
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

    // Step 2: 한글 없는 영상 삭제 (외국 영상 정리)
    const allVideos = await prisma.video.findMany({
      select: { id: true, title: true },
    });
    const nonKoreanIds = allVideos
      .filter(v => !/[가-힣]/.test(v.title))
      .map(v => v.id);

    if (nonKoreanIds.length > 0) {
      const deleteNonKR = await prisma.video.deleteMany({
        where: { id: { in: nonKoreanIds } },
      });
      results.deletedNonKorean = deleteNonKR.count;
    }

    // Step 3: 한국 바이럴 영상 수집
    try {
      const origin = request.nextUrl.origin;
      const token = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

      const collectRes = await fetch(`${origin}/api/collect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ geo: 'KR' }),
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
