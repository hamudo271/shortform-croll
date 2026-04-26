import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { Platform, Category } from '@prisma/client';

/**
 * Server-side data layer for the public landing page.
 *
 * All queries are wrapped in `unstable_cache` with a 1-hour TTL so the
 * landing page renders fast without hammering the DB on every visit.
 * Stale data is acceptable here — the marketing page doesn't need
 * minute-level accuracy.
 */

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface LandingStats {
  total: number;
  todayCount: number;
  categoryCount: number;
  platformCounts: Record<Platform, number>;
}

export interface TopProduct {
  id: string;
  platform: Platform;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  viralScore: number;
  category: Category | null;
  authorName: string | null;
}

export const getLandingStats = unstable_cache(
  async (): Promise<LandingStats> => {
    try {
      const [total, platformGroup, todayCount, categoryGroup] = await Promise.all([
        prisma.video.count(),
        prisma.video.groupBy({
          by: ['platform'],
          _count: { _all: true },
        }),
        prisma.video.count({ where: { createdAt: { gte: startOfToday() } } }),
        prisma.video.groupBy({
          by: ['category'],
          _count: { _all: true },
          where: { category: { not: null } },
        }),
      ]);

      const platformCounts: Record<Platform, number> = {
        YOUTUBE: 0,
        TIKTOK: 0,
        INSTAGRAM: 0,
      };
      for (const row of platformGroup) {
        platformCounts[row.platform] = row._count._all;
      }

      return {
        total,
        todayCount,
        categoryCount: categoryGroup.length,
        platformCounts,
      };
    } catch (err) {
      // Fail soft so the landing page still renders if DB is unreachable.
      console.error('getLandingStats failed:', err);
      return {
        total: 0,
        todayCount: 0,
        categoryCount: 0,
        platformCounts: { YOUTUBE: 0, TIKTOK: 0, INSTAGRAM: 0 },
      };
    }
  },
  ['landing-stats'],
  { revalidate: 3600, tags: ['landing'] }
);

export const getTopProducts = unstable_cache(
  async (limit: number = 8): Promise<TopProduct[]> => {
    try {
      const rows = await prisma.video.findMany({
        orderBy: { viewCount: 'desc' },
        take: limit,
        where: {
          // Skip videos with empty thumbnails — landing visuals depend on them
          thumbnailUrl: { not: '' },
          // Skip too-low-engagement videos (likely failed collections)
          viewCount: { gt: BigInt(1000) },
        },
        select: {
          id: true,
          platform: true,
          title: true,
          thumbnailUrl: true,
          viewCount: true,
          likeCount: true,
          viralScore: true,
          category: true,
          authorName: true,
        },
      });

      // Convert BigInt to Number for client component serialization
      return rows.map((r) => ({
        ...r,
        viewCount: Number(r.viewCount),
        likeCount: Number(r.likeCount),
      }));
    } catch (err) {
      console.error('getTopProducts failed:', err);
      return [];
    }
  },
  ['landing-top-products'],
  { revalidate: 3600, tags: ['landing'] }
);
