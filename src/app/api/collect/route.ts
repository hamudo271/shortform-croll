import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchYouTubeShorts, getYouTubeVideoUrl, getYouTubeChannelUrl } from '@/lib/collectors/youtube';
import { collectTrendingTikToks, closeBrowser as closeTikTokBrowser } from '@/lib/collectors/tiktok';
import { collectTrendingReels, closeBrowser as closeInstagramBrowser } from '@/lib/collectors/instagram';
import { classifyVideo, classifyByKeywords } from '@/lib/classifier';
import { calculateViralScore } from '@/lib/utils';
import { Platform } from '@prisma/client';

// This endpoint triggers data collection
// Should be called by GitHub Actions or manually

export async function POST(request: NextRequest) {
  // Simple auth check
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    youtube: { collected: 0, errors: 0 },
    tiktok: { collected: 0, errors: 0 },
    instagram: { collected: 0, errors: 0 },
  };

  let keyword: string | undefined;
  try {
    const body = await request.json();
    if (body.keyword) keyword = body.keyword;
  } catch (e) {
    // Ignore JSON parse errors if body is empty
  }

  try {
    // 1. Collect YouTube Shorts
    if (process.env.YOUTUBE_API_KEY) {
      try {
        const youtubeVideos = await searchYouTubeShorts(process.env.YOUTUBE_API_KEY, {
          maxResults: 50,
          keyword,
        });

        for (const video of youtubeVideos) {
          try {
            // Classify video
            let classification;
            if (process.env.GEMINI_API_KEY) {
              classification = await classifyVideo(process.env.GEMINI_API_KEY, {
                title: video.title,
                description: video.description,
                authorName: video.channelTitle,
              });
            } else {
              classification = classifyByKeywords({
                title: video.title,
                description: video.description,
              });
            }

            // Get existing video for history tracking
            const existing = await prisma.video.findUnique({
              where: { videoId: video.id },
            });

            // Build view count history
            const history = existing?.viewCountHistory as Array<{ date: string; count: number }> || [];
            history.push({
              date: new Date().toISOString(),
              count: video.viewCount,
            });

            // Keep only last 30 days of history
            const recentHistory = history.slice(-30);

            // Calculate viral score
            const viralScore = calculateViralScore(recentHistory);

            await prisma.video.upsert({
              where: { videoId: video.id },
              update: {
                title: video.title,
                description: video.description,
                thumbnailUrl: video.thumbnailUrl,
                viewCount: BigInt(video.viewCount),
                likeCount: BigInt(video.likeCount),
                commentCount: BigInt(video.commentCount),
                viewCountHistory: recentHistory,
                viralScore,
                category: classification.category,
                targetAge: classification.targetAge,
                tags: classification.tags,
                country: video.country || 'Global',
                updatedAt: new Date(),
              },
              create: {
                platform: Platform.YOUTUBE,
                videoId: video.id,
                title: video.title,
                description: video.description,
                thumbnailUrl: video.thumbnailUrl,
                videoUrl: getYouTubeVideoUrl(video.id),
                authorName: video.channelTitle,
                authorUrl: getYouTubeChannelUrl(video.channelId),
                viewCount: BigInt(video.viewCount),
                likeCount: BigInt(video.likeCount),
                commentCount: BigInt(video.commentCount),
                viewCountHistory: recentHistory,
                viralScore,
                category: classification.category,
                targetAge: classification.targetAge,
                tags: classification.tags,
                country: video.country || 'Global',
                publishedAt: new Date(video.publishedAt),
              },
            });

            results.youtube.collected++;
          } catch (err) {
            console.error('YouTube video save error:', err);
            results.youtube.errors++;
          }
        }
      } catch (err) {
        console.error('YouTube collection error:', err);
        results.youtube.errors++;
      }
    }

    // 2. Collect TikTok videos
    try {
      const tiktokVideos = await collectTrendingTikToks(keyword);

      for (const video of tiktokVideos) {
        try {
          let classification;
          if (process.env.GEMINI_API_KEY) {
            classification = await classifyVideo(process.env.GEMINI_API_KEY, {
              title: video.title,
              description: video.description,
              authorName: video.authorName,
            });
          } else {
            classification = classifyByKeywords({
              title: video.title,
              description: video.description,
            });
          }

          const existing = await prisma.video.findUnique({
            where: { videoId: video.id },
          });

          const history = existing?.viewCountHistory as Array<{ date: string; count: number }> || [];
          history.push({
            date: new Date().toISOString(),
            count: video.viewCount,
          });

          const recentHistory = history.slice(-30);
          const viralScore = calculateViralScore(recentHistory);

          await prisma.video.upsert({
            where: { videoId: video.id },
            update: {
              title: video.title,
              viewCount: BigInt(video.viewCount),
              likeCount: BigInt(video.likeCount),
              shareCount: BigInt(video.shareCount),
              viewCountHistory: recentHistory,
              viralScore,
              category: classification.category,
              targetAge: classification.targetAge,
              tags: classification.tags,
              updatedAt: new Date(),
            },
            create: {
              platform: Platform.TIKTOK,
              videoId: video.id,
              title: video.title,
              description: video.description,
              thumbnailUrl: video.thumbnailUrl,
              videoUrl: video.videoUrl,
              authorName: video.authorName,
              authorUrl: video.authorUrl,
              viewCount: BigInt(video.viewCount),
              likeCount: BigInt(video.likeCount),
              shareCount: BigInt(video.shareCount),
              viewCountHistory: recentHistory,
              viralScore,
              category: classification.category,
              targetAge: classification.targetAge,
              tags: classification.tags,
              country: video.country || 'Global',
            },
          });

          results.tiktok.collected++;
        } catch (err) {
          console.error('TikTok video save error:', err);
          results.tiktok.errors++;
        }
      }
    } catch (err) {
      console.error('TikTok collection error:', err);
      results.tiktok.errors++;
    } finally {
      await closeTikTokBrowser();
    }

    // 3. Collect Instagram Reels
    try {
      const instagramReels = await collectTrendingReels(keyword);

      for (const reel of instagramReels) {
        try {
          let classification;
          if (process.env.GEMINI_API_KEY) {
            classification = await classifyVideo(process.env.GEMINI_API_KEY, {
              title: reel.title,
              description: reel.description,
              authorName: reel.authorName,
            });
          } else {
            classification = classifyByKeywords({
              title: reel.title,
              description: reel.description,
            });
          }

          const existing = await prisma.video.findUnique({
            where: { videoId: reel.id },
          });

          const history = existing?.viewCountHistory as Array<{ date: string; count: number }> || [];
          history.push({
            date: new Date().toISOString(),
            count: reel.viewCount,
          });

          const recentHistory = history.slice(-30);
          const viralScore = calculateViralScore(recentHistory);

          await prisma.video.upsert({
            where: { videoId: reel.id },
            update: {
              title: reel.title,
              viewCount: BigInt(reel.viewCount),
              likeCount: BigInt(reel.likeCount),
              viewCountHistory: recentHistory,
              viralScore,
              category: classification.category,
              targetAge: classification.targetAge,
              tags: classification.tags,
              updatedAt: new Date(),
            },
            create: {
              platform: Platform.INSTAGRAM,
              videoId: reel.id,
              title: reel.title,
              description: reel.description,
              thumbnailUrl: reel.thumbnailUrl,
              videoUrl: reel.videoUrl,
              authorName: reel.authorName,
              authorUrl: reel.authorUrl,
              viewCount: BigInt(reel.viewCount),
              likeCount: BigInt(reel.likeCount),
              viewCountHistory: recentHistory,
              viralScore,
              category: classification.category,
              targetAge: classification.targetAge,
              tags: classification.tags,
              country: reel.country || 'Global',
            },
          });

          results.instagram.collected++;
        } catch (err) {
          console.error('Instagram reel save error:', err);
          results.instagram.errors++;
        }
      }
    } catch (err) {
      console.error('Instagram collection error:', err);
      results.instagram.errors++;
    } finally {
      await closeInstagramBrowser();
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Collection error:', error);
    return NextResponse.json(
      { error: 'Collection failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return collection status
  try {
    const counts = await prisma.video.groupBy({
      by: ['platform'],
      _count: true,
    });

    const lastCollected = await prisma.video.findFirst({
      orderBy: { collectedAt: 'desc' },
      select: { collectedAt: true },
    });

    return NextResponse.json({
      counts: counts.reduce((acc, c) => ({ ...acc, [c.platform]: c._count }), {}),
      lastCollected: lastCollected?.collectedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
