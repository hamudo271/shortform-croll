import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tiktokVideos = await prisma.video.findMany({
      where: { platform: 'TIKTOK' },
      select: { id: true, videoUrl: true, thumbnailUrl: true },
    });

    let fixed = 0;

    for (const video of tiktokVideos) {
      // videoUrl에서 video ID 추출: .../video/1234567890
      const match = video.videoUrl.match(/\/video\/(\d+)/);
      if (!match) continue;

      const videoId = match[1];
      const stableUrl = `https://www.tikwm.com/video/cover/${videoId}.webp`;

      // 이미 stable URL이면 스킵
      if (video.thumbnailUrl === stableUrl) continue;

      await prisma.video.update({
        where: { id: video.id },
        data: { thumbnailUrl: stableUrl },
      });
      fixed++;
    }

    return NextResponse.json({
      success: true,
      totalTiktok: tiktokVideos.length,
      fixed,
    });
  } catch (error) {
    console.error('Fix thumbnails error:', error);
    return NextResponse.json(
      { error: 'Failed', details: String(error) },
      { status: 500 }
    );
  }
}