import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [
      totalCount,
      platformCounts,
      categoryCounts,
      lastCollected,
      topVideos,
      recentCollections,
    ] = await Promise.all([
      prisma.video.count(),
      prisma.video.groupBy({ by: ['platform'], _count: true }),
      prisma.video.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
      prisma.video.findFirst({
        orderBy: { collectedAt: 'desc' },
        select: { collectedAt: true },
      }),
      prisma.video.findMany({
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
      }),
      // Collection activity: count of videos collected per day for last 7 days
      prisma.$queryRaw`
        SELECT DATE(\"collectedAt\") as date, COUNT(*)::int as count
        FROM "Video"
        WHERE "collectedAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("collectedAt")
        ORDER BY date ASC
      ` as Promise<Array<{ date: string; count: number }>>,
    ]);

    return NextResponse.json({
      totalCount,
      platforms: platformCounts.reduce(
        (acc, c) => ({ ...acc, [c.platform]: c._count }),
        {} as Record<string, number>
      ),
      categories: categoryCounts
        .filter(c => c.category !== null)
        .reduce(
          (acc, c) => ({ ...acc, [c.category!]: c._count }),
          {} as Record<string, number>
        ),
      lastCollectedAt: lastCollected?.collectedAt || null,
      topVideos: topVideos.map(v => ({
        ...v,
        viewCount: Number(v.viewCount),
        likeCount: Number(v.likeCount),
      })),
      recentCollections,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
