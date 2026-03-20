import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 깨진 썸네일(tikwm proxy URL)을 가진 TikTok 영상 삭제
    // 다시 수집하면 새 CDN URL을 받아옴
    const broken = await prisma.video.findMany({
      where: {
        platform: 'TIKTOK',
        thumbnailUrl: { contains: 'tikwm.com/video/cover' },
      },
      select: { id: true },
    });

    if (broken.length > 0) {
      await prisma.video.deleteMany({
        where: { id: { in: broken.map(v => v.id) } },
      });
    }

    return NextResponse.json({
      success: true,
      deletedBroken: broken.length,
      message: `${broken.length}개 깨진 썸네일 영상 삭제. /api/collect로 다시 수집하세요.`,
    });
  } catch (error) {
    console.error('Fix thumbnails error:', error);
    return NextResponse.json(
      { error: 'Failed', details: String(error) },
      { status: 500 }
    );
  }
}