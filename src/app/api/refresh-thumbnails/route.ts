import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 모든 TikTok 영상의 thumbnailUrl을 fresh tikwm CDN URL로 갱신.
 *
 * tikwm가 돌려주는 cover URL은 약 24~48시간 유효한 signed URL이므로,
 * 매일 한 번 이 엔드포인트를 호출해서 DB의 thumbnailUrl을 갈아끼우면
 * 화면이 항상 살아있다. 1 req/sec 한도를 지키기 위해 순차 호출.
 *
 * 인증: COLLECT_API_KEY (Bearer)
 * 호출: GitHub Actions cron, 또는 /api/cron 안에서 위임 호출.
 */

export const maxDuration = 300;

const RATE_LIMIT_MS = 1100;

async function fetchFreshCover(videoUrl: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const cover: string | undefined =
        data?.data?.origin_cover || data?.data?.cover || data?.data?.ai_dynamic_cover;
      if (cover) return cover;
      // rate limit 응답이면 한 번 더 대기 후 재시도
      if (typeof data?.msg === 'string' && data.msg.toLowerCase().includes('limit')) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
        continue;
      }
      return null;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const expected = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const videos = await prisma.video.findMany({
    where: { platform: 'TIKTOK' },
    select: { id: true, videoUrl: true },
  });

  let refreshed = 0;
  let failed = 0;
  for (const v of videos) {
    if (!v.videoUrl) continue;
    const cover = await fetchFreshCover(v.videoUrl);
    if (cover) {
      await prisma.video.update({
        where: { id: v.id },
        data: { thumbnailUrl: cover },
      });
      refreshed++;
    } else {
      failed++;
    }
    // 1 req/sec — tikwm 무료 한도
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  return NextResponse.json({
    success: true,
    total: videos.length,
    refreshed,
    failed,
  });
}
