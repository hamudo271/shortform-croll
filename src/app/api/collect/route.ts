import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchYouTubeShorts, getYouTubeVideoUrl, getYouTubeChannelUrl } from '@/lib/collectors/youtube';
import {
  getRisingProductTrends,
  getDailyTrendingProducts,
  generateSearchQueries,
  VIRAL_PRODUCT_KEYWORDS,
} from '@/lib/collectors/trendCollector';
import { classifyVideo, classifyByKeywords } from '@/lib/classifier';
import { calculateViralScore } from '@/lib/utils';
import { Platform } from '@prisma/client';

/**
 * Smart Dropshipping Product Video Collector
 *
 * 전략:
 * 1. Google Trends에서 급상승 상품 키워드 수집
 * 2. 해당 키워드로 YouTube 검색 (최근 48시간, 조회수 높은 것)
 * 3. 드랍쉬핑 특화 키워드 병행 검색
 * 4. 높은 engagement 영상만 저장
 */

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    trendsFound: 0,
    videosSearched: 0,
    videosCollected: 0,
    videosSkipped: 0,
    errors: [] as string[],
  };

  // Parse request options
  let manualKeyword: string | undefined;
  let targetGeo = 'US'; // 기본: 미국 (드랍쉬핑 주요 시장)

  try {
    const body = await request.json();
    if (body.keyword) manualKeyword = body.keyword;
    if (body.geo) targetGeo = body.geo;
  } catch {
    // Empty body is OK
  }

  try {
    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YOUTUBE_API_KEY required' }, { status: 500 });
    }

    // ===== STEP 1: 검색 키워드 수집 =====
    let searchQueries: string[] = [];

    if (manualKeyword) {
      // 수동 키워드 제공시 해당 키워드만 사용
      searchQueries = [`${manualKeyword} unboxing shorts`, `${manualKeyword} review`];
    } else {
      // Google Trends에서 급상승 상품 트렌드 가져오기
      console.log('🔍 Fetching rising product trends from Google Trends...');

      try {
        const [risingTrends, dailyTrends] = await Promise.all([
          getRisingProductTrends(targetGeo),
          getDailyTrendingProducts(targetGeo),
        ]);

        results.trendsFound = risingTrends.length + dailyTrends.length;
        console.log(`📈 Found ${risingTrends.length} rising trends, ${dailyTrends.length} daily trends`);

        // 트렌드 기반 검색 쿼리 생성
        searchQueries = generateSearchQueries(risingTrends);

        // 일일 트렌드 추가
        for (const trend of dailyTrends.slice(0, 5)) {
          searchQueries.push(`${trend} shorts review`);
        }
      } catch (err) {
        console.error('Google Trends error:', err);
        results.errors.push('Google Trends fetch failed');
      }

      // 트렌드가 없으면 기본 드랍쉬핑 키워드 사용
      if (searchQueries.length === 0) {
        console.log('⚠️ No trends found, using default dropshipping keywords');
        if (targetGeo === 'KR') {
          // 한국 수집: 한국어 키워드 우선, 글로벌은 소량
          searchQueries = [...VIRAL_PRODUCT_KEYWORDS.korean, ...VIRAL_PRODUCT_KEYWORDS.global.slice(0, 3)];
        } else {
          searchQueries = [...VIRAL_PRODUCT_KEYWORDS.global, ...VIRAL_PRODUCT_KEYWORDS.korean];
        }
      }

      // 한국 수집 시 한국어 키워드를 앞에 배치
      if (targetGeo === 'KR' && searchQueries.length > 0) {
        const koreanQueries = searchQueries.filter(q => /[가-힣]/.test(q));
        const otherQueries = searchQueries.filter(q => !/[가-힣]/.test(q));
        searchQueries = [...koreanQueries, ...otherQueries];
      }
    }

    console.log(`🔎 Search queries (${searchQueries.length}):`, searchQueries.slice(0, 5));

    // ===== STEP 2: YouTube 검색 =====
    const processedVideoIds = new Set<string>();
    const MIN_VIEWS = targetGeo === 'KR' ? 10000 : 50000; // 한국은 1만, 글로벌은 5만
    const MIN_ENGAGEMENT = 0.01; // 최소 1% 참여율

    for (const query of searchQueries.slice(0, 15)) { // 최대 15개 쿼리
      console.log(`\n🎬 Searching: "${query}"`);

      try {
        // 최근 48시간 영상만, 조회수순 정렬
        const videos = await searchYouTubeShorts(process.env.YOUTUBE_API_KEY, {
          query,
          maxResults: 15,
          regionCode: targetGeo === 'KR' ? 'KR' : 'US',
        });

        results.videosSearched += videos.length;

        for (const video of videos) {
          if (processedVideoIds.has(video.id)) continue;
          processedVideoIds.add(video.id);

          // Engagement 필터
          const engagement = video.viewCount > 0 ? video.likeCount / video.viewCount : 0;

          if (video.viewCount < MIN_VIEWS) {
            results.videosSkipped++;
            continue;
          }

          if (engagement < MIN_ENGAGEMENT) {
            results.videosSkipped++;
            continue;
          }

          try {
            // AI 분류
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

            // 상품이 아닌 영상 스킵
            if (classification.category === 'OTHER') {
              console.log(`  ❌ Skip (not product): ${video.title.substring(0, 40)}...`);
              results.videosSkipped++;
              continue;
            }

            // DB 저장
            const existing = await prisma.video.findUnique({
              where: { videoId: video.id },
            });

            const history = (existing?.viewCountHistory as Array<{ date: string; count: number }>) || [];
            history.push({ date: new Date().toISOString(), count: video.viewCount });
            const recentHistory = history.slice(-30);
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
                country: video.country || targetGeo,
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
                country: video.country || targetGeo,
                publishedAt: new Date(video.publishedAt),
              },
            });

            console.log(`  ✅ Saved: ${video.title.substring(0, 40)}... (${formatNumber(video.viewCount)} views, ${(engagement * 100).toFixed(1)}% eng)`);
            results.videosCollected++;
          } catch (err) {
            console.error('Video save error:', err);
            results.errors.push(`Save failed: ${video.id}`);
          }
        }
      } catch (err) {
        console.error(`Search error for "${query}":`, err);
        results.errors.push(`Search failed: ${query}`);
      }

      await delay(500); // Rate limiting
    }

    return NextResponse.json({
      success: true,
      results,
      searchQueries: searchQueries.slice(0, 10),
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
  try {
    const [counts, categoryCounts, lastCollected, topVideos] = await Promise.all([
      prisma.video.groupBy({ by: ['platform'], _count: true }),
      prisma.video.groupBy({ by: ['category'], _count: true }),
      prisma.video.findFirst({
        orderBy: { collectedAt: 'desc' },
        select: { collectedAt: true },
      }),
      prisma.video.findMany({
        orderBy: { viralScore: 'desc' },
        take: 5,
        select: { title: true, viewCount: true, viralScore: true },
      }),
    ]);

    return NextResponse.json({
      counts: counts.reduce((acc, c) => ({ ...acc, [c.platform]: c._count }), {}),
      categories: categoryCounts.reduce((acc, c) => ({ ...acc, [c.category || 'UNKNOWN']: c._count }), {}),
      lastCollected: lastCollected?.collectedAt,
      topVideos: topVideos.map(v => ({
        title: v.title?.substring(0, 50),
        views: Number(v.viewCount),
        score: v.viralScore,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
