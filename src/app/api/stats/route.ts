import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const totalCount = await prisma.video.count();
    const platformCounts = await prisma.video.groupBy({
      by: ['platform'],
      _count: true,
    });
    const categoryCounts = await prisma.video.groupBy({
      by: ['category'],
      _count: true,
    });
    const lastCollected = await prisma.video.findFirst({
      orderBy: { collectedAt: 'desc' },
      select: { collectedAt: true },
    });
    const topVideos = await prisma.video.findMany({
      orderBy: { viralScore: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        videoUrl: true,
        thumbnailUrl: true,
        viewCount: true,
        likeCount: true,
        viralScore: true,
        platform: true,
        category: true,
        authorName: true,
        collectedAt: true,
      },
    });

    const platforms: Record<string, number> = {};
    for (const c of platformCounts) {
      platforms[c.platform] = c._count;
    }

    const categories: Record<string, number> = {};
    for (const c of categoryCounts) {
      if (c.category) {
        categories[c.category] = c._count;
      }
    }

    const res = NextResponse.json({
      totalCount,
      platforms,
      categories,
      lastCollectedAt: lastCollected?.collectedAt || null,
      topVideos: topVideos.map(v => ({
        ...v,
        viewCount: Number(v.viewCount),
        likeCount: Number(v.likeCount),
      })),
    });
    res.headers.set('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res;
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
