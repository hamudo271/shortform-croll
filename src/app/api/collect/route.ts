import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchYouTubeShorts, getYouTubeVideoUrl, getYouTubeChannelUrl } from '@/lib/collectors/youtube';
import { getProductSearchQueries } from '@/lib/collectors/googleTrends';
import { classifyVideo, classifyByKeywords } from '@/lib/classifier';
import { calculateViralScore } from '@/lib/utils';
import { Platform } from '@prisma/client';

// This endpoint triggers data collection
// Uses Google Trends to find trending product keywords
// Then searches YouTube for product videos

export async function POST(request: NextRequest) {
  // Simple auth check
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    youtube: { collected: 0, errors: 0 },
    trends: { keywords: 0 },
  };

  let keyword: string | undefined;
  let category: string | undefined;
  let useGoogleTrends = true;

  try {
    const body = await request.json();
    if (body.keyword) {
      keyword = body.keyword;
      useGoogleTrends = false; // Manual keyword provided, skip Google Trends
    }
    if (body.category) category = body.category;
    if (body.useGoogleTrends === false) useGoogleTrends = false;
  } catch {
    // Ignore JSON parse errors if body is empty
  }

  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: 'YOUTUBE_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Step 1: Get trending product keywords from Google Trends
    let searchQueries: string[] = [];

    if (useGoogleTrends) {
      try {
        console.log('Fetching trending keywords from Google Trends...');
        searchQueries = await getProductSearchQueries({
          category,
          geo: 'KR',
          count: 5, // Get 5 trending queries
        });
        results.trends.keywords = searchQueries.length;
        console.log(`Found ${searchQueries.length} trending keywords:`, searchQueries);
      } catch (err) {
        console.error('Google Trends error:', err);
        // Fall back to manual keyword or default
      }
    }

    // If manual keyword provided or Google Trends failed, use that
    if (keyword) {
      searchQueries = [keyword];
    } else if (searchQueries.length === 0) {
      // Default fallback queries
      searchQueries = [
        '틱톡템 추천 shorts',
        '다이소 꿀템 shorts',
        'tiktokmademebuyit',
      ];
    }

    // Step 2: Search YouTube for each trending keyword
    const processedVideoIds = new Set<string>();

    for (const query of searchQueries) {
      console.log(`Searching YouTube for: "${query}"`);

      try {
        const youtubeVideos = await searchYouTubeShorts(process.env.YOUTUBE_API_KEY, {
          query,
          maxResults: 20, // 20 per keyword
        });

        for (const video of youtubeVideos) {
          // Skip if already processed
          if (processedVideoIds.has(video.id)) continue;
          processedVideoIds.add(video.id);

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

            // Skip non-product videos (classified as OTHER)
            if (classification.category === 'OTHER') {
              console.log(`Skipping non-product video: ${video.title.substring(0, 30)}...`);
              continue;
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
        console.error(`YouTube search error for "${query}":`, err);
        results.youtube.errors++;
      }

      // Rate limiting between searches
      await delay(1000);
    }

    return NextResponse.json({
      success: true,
      results,
      searchQueries,
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

    const categoryCounts = await prisma.video.groupBy({
      by: ['category'],
      _count: true,
    });

    const lastCollected = await prisma.video.findFirst({
      orderBy: { collectedAt: 'desc' },
      select: { collectedAt: true },
    });

    return NextResponse.json({
      counts: counts.reduce((acc, c) => ({ ...acc, [c.platform]: c._count }), {}),
      categories: categoryCounts.reduce((acc, c) => ({ ...acc, [c.category || 'UNKNOWN']: c._count }), {}),
      lastCollected: lastCollected?.collectedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
