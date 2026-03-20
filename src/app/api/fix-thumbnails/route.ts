import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. 깨진 tikwm 프록시 URL
    const brokenTikwm = await prisma.video.findMany({
      where: { thumbnailUrl: { contains: 'tikwm.com/video/cover' } },
      select: { id: true },
    });

    // 2. 빈 썸네일 영상 (빈 문자열)
    const emptyThumb = await prisma.video.findMany({
      where: { thumbnailUrl: { equals: '' } },
      select: { id: true },
    });

    const toDelete = [...brokenTikwm.map(v => v.id), ...emptyThumb.map(v => v.id)];
    const uniqueIds = [...new Set(toDelete)];

    if (uniqueIds.length > 0) {
      await prisma.video.deleteMany({
        where: { id: { in: uniqueIds } },
      });
    }

    return NextResponse.json({
      success: true,
      deletedBrokenTikwm: brokenTikwm.length,
      deletedEmptyThumb: emptyThumb.length,
      totalDeleted: uniqueIds.length,
      message: `${uniqueIds.length}개 삭제. /api/collect로 다시 수집하세요.`,
    });
  } catch (error) {
    console.error('Fix thumbnails error:', error);
    return NextResponse.json(
      { error: 'Failed', details: String(error) },
      { status: 500 }
    );
  }
}