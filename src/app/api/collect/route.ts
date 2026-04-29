import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchYouTubeShorts, getYouTubeVideoUrl, getYouTubeChannelUrl } from '@/lib/collectors/youtube';
import { searchTikTokVideos, getTikTokTrending } from '@/lib/collectors/tiktok-api';
import { collectKoreanReelsPublic } from '@/lib/collectors/instagram-public';
import {
  getRisingProductTrends,
  getDailyTrendingProducts,
  generateSearchQueries,
  VIRAL_PRODUCT_KEYWORDS,
} from '@/lib/collectors/trendCollector';
import { classifyVideo, classifyByKeywords } from '@/lib/classifier';
import { calculateViralScore } from '@/lib/utils';
import { Platform } from '@prisma/client';

// 수집은 ~60초 걸림 — Vercel/Railway 기본 타임아웃 회피
export const maxDuration = 300;

// 최신성 컷오프 — 이 날짜 이전 업로드된 영상은 모두 스킵
const MIN_PUBLISHED_AT = new Date('2025-12-01T00:00:00Z');

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
  let targetGeo = 'US'; // 기본: 영어권 (해외 아이디어템 풀)

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
      // 수동 키워드: 영어 product-discovery suffix 자동 부착
      searchQueries = [
        `${manualKeyword} review shorts`,
        `${manualKeyword} unboxing`,
        `${manualKeyword} amazon finds`,
      ];
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

      // 트렌드가 없으면 기본 해외 아이디어템 키워드 사용
      if (searchQueries.length === 0) {
        console.log('⚠️ No trends found, using default global product keywords');
        searchQueries = [...VIRAL_PRODUCT_KEYWORDS.global];
      }
    }

    console.log(`🔎 Search queries (${searchQueries.length}):`, searchQueries.slice(0, 5));

    // ===== STEP 2: YouTube 검색 =====
    const processedVideoIds = new Set<string>();
    const MIN_VIEWS = 20000; // 해외 영상 조회수 2만 이상 (3일 윈도우 고려)
    const MIN_ENGAGEMENT = 0.01; // 최소 1% 참여율

    for (const query of searchQueries.slice(0, 15)) { // 최대 15개 쿼리
      console.log(`\n🎬 Searching: "${query}"`);

      try {
        // 최근 48시간 영상만, 조회수순 정렬
        const videos = await searchYouTubeShorts(process.env.YOUTUBE_API_KEY, {
          query,
          maxResults: 15,
          regionCode: targetGeo,
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

          // 최신성 컷오프
          const ytPublished = new Date(video.publishedAt);
          if (ytPublished < MIN_PUBLISHED_AT) {
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

    // ===== STEP 3: 틱톡 수집 =====
    console.log('\n🎵 Collecting TikTok videos...');
    let tiktokCollected = 0;

    try {
      // 틱톡 트렌딩 (US)
      const trendingVideos = await getTikTokTrending({ count: 30 });
      console.log(`  Found ${trendingVideos.length} trending TikTok videos`);

      for (const video of trendingVideos) {
        if (processedVideoIds.has(video.id)) continue;
        if (video.viewCount < 20000) continue;
        // 영어 텍스트 필수, 한글이 들어가면 제외
        if (!/[a-zA-Z]{3,}/.test(video.title)) continue;
        if (/[가-힣]/.test(video.title)) continue;

        // 최신성 컷오프 — create_time 없으면 안전하게 skip
        const tkPublished = video.createTime ? new Date(video.createTime * 1000) : null;
        if (!tkPublished || tkPublished < MIN_PUBLISHED_AT) continue;

        processedVideoIds.add(video.id);

        try {
          let classification;
          if (process.env.GEMINI_API_KEY) {
            classification = await classifyVideo(process.env.GEMINI_API_KEY, {
              title: video.title,
              description: video.description,
              authorName: video.authorName,
            });
          } else {
            classification = classifyByKeywords({ title: video.title, description: video.description });
          }

          await prisma.video.upsert({
            where: { videoId: `tiktok_${video.id}` },
            update: {
              title: video.title,
              thumbnailUrl: video.thumbnailUrl,
              viewCount: BigInt(video.viewCount),
              likeCount: BigInt(video.likeCount),
              commentCount: BigInt(video.commentCount),
              shareCount: BigInt(video.shareCount),
              category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
              targetAge: classification.targetAge,
              tags: classification.tags,
              country: 'US',
              publishedAt: tkPublished,
              updatedAt: new Date(),
            },
            create: {
              platform: Platform.TIKTOK,
              videoId: `tiktok_${video.id}`,
              title: video.title,
              description: video.description,
              thumbnailUrl: video.thumbnailUrl,
              videoUrl: video.videoUrl,
              authorName: video.authorName,
              authorUrl: `https://www.tiktok.com/@${video.authorId}`,
              viewCount: BigInt(video.viewCount),
              likeCount: BigInt(video.likeCount),
              commentCount: BigInt(video.commentCount),
              shareCount: BigInt(video.shareCount),
              viralScore: video.viewCount > 1000000 ? 90 : video.viewCount > 100000 ? 60 : 30,
              category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
              targetAge: classification.targetAge,
              tags: classification.tags,
              country: 'US',
              publishedAt: tkPublished,
            },
          });
          tiktokCollected++;
        } catch (err) {
          console.error('TikTok save error:', err);
        }
      }
    } catch (err) {
      console.error('TikTok trending error:', err);
      results.errors.push('TikTok trending failed');
    }

    // 틱톡 키워드 검색 (해외 아이디어템 풀)
    const tiktokKeywords = [
      'tiktokmademebuyit', 'amazonfinds', 'amazonmusthaves',
      'cool gadgets', 'kitchen gadgets', 'home gadgets',
      'must have products', 'satisfying products', 'genius inventions',
      'temu finds',
    ];
    for (const kw of tiktokKeywords) {
      try {
        const videos = await searchTikTokVideos(kw, { count: 20 });
        for (const video of videos) {
          if (processedVideoIds.has(video.id)) continue;
          if (video.viewCount < 20000) continue;
          if (!/[a-zA-Z]{3,}/.test(video.title)) continue;
          if (/[가-힣]/.test(video.title)) continue;

          // 최신성 컷오프
          const tkPublished = video.createTime ? new Date(video.createTime * 1000) : null;
          if (!tkPublished || tkPublished < MIN_PUBLISHED_AT) continue;

          processedVideoIds.add(video.id);

          try {
            const classification = classifyByKeywords({ title: video.title, description: video.description });

            await prisma.video.upsert({
              where: { videoId: `tiktok_${video.id}` },
              update: {
                thumbnailUrl: video.thumbnailUrl,
                viewCount: BigInt(video.viewCount),
                likeCount: BigInt(video.likeCount),
                publishedAt: tkPublished,
                updatedAt: new Date(),
              },
              create: {
                platform: Platform.TIKTOK,
                videoId: `tiktok_${video.id}`,
                title: video.title,
                description: video.description,
                thumbnailUrl: video.thumbnailUrl,
                videoUrl: video.videoUrl,
                authorName: video.authorName,
                authorUrl: `https://www.tiktok.com/@${video.authorId}`,
                viewCount: BigInt(video.viewCount),
                likeCount: BigInt(video.likeCount),
                commentCount: BigInt(video.commentCount),
                shareCount: BigInt(video.shareCount),
                viralScore: video.viewCount > 1000000 ? 90 : video.viewCount > 100000 ? 60 : 30,
                category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
                targetAge: classification.targetAge,
                tags: classification.tags,
                country: 'US',
                publishedAt: tkPublished,
              },
            });
            tiktokCollected++;
          } catch {}
        }
        await delay(300);
      } catch (err) {
        console.error(`TikTok search error for "${kw}":`, err);
      }
    }

    console.log(`🎵 TikTok: collected ${tiktokCollected} videos`);

    // ===== STEP 4: 인스타그램 릴스 수집 (공개 API, 키 불필요) =====
    let instagramCollected = 0;

    {
      console.log('\n📷 Collecting Instagram Reels (public API)...');
      try {
        const { reels, errors: igErrors } = await collectKoreanReelsPublic();
        console.log(`  Found ${reels.length} reels`);

        for (const reel of reels) {
          if (processedVideoIds.has(reel.id)) continue;
          if (reel.viewCount < 10000) continue;
          // 한글 콘텐츠 제외 (해외 풀 전환)
          if (/[가-힣]/.test(reel.title) || /[가-힣]/.test(reel.description)) continue;

          // 최신성 컷오프
          const igPublished = reel.takenAt ? new Date(reel.takenAt * 1000) : null;
          if (!igPublished || igPublished < MIN_PUBLISHED_AT) continue;

          processedVideoIds.add(reel.id);

          try {
            const classification = classifyByKeywords({ title: reel.title, description: reel.description });

            await prisma.video.upsert({
              where: { videoId: `ig_${reel.id}` },
              update: {
                viewCount: BigInt(reel.viewCount),
                likeCount: BigInt(reel.likeCount),
                commentCount: BigInt(reel.commentCount),
                publishedAt: igPublished,
                updatedAt: new Date(),
              },
              create: {
                platform: Platform.INSTAGRAM,
                videoId: `ig_${reel.id}`,
                title: reel.title,
                description: reel.description,
                thumbnailUrl: reel.thumbnailUrl,
                videoUrl: reel.videoUrl,
                authorName: reel.authorName,
                authorUrl: `https://www.instagram.com/${reel.authorId}/`,
                viewCount: BigInt(reel.viewCount),
                likeCount: BigInt(reel.likeCount),
                commentCount: BigInt(reel.commentCount),
                shareCount: BigInt(reel.shareCount),
                viralScore: reel.viewCount > 1000000 ? 90 : reel.viewCount > 100000 ? 60 : 30,
                category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
                targetAge: classification.targetAge,
                tags: classification.tags,
                country: 'US',
                publishedAt: igPublished,
              },
            });
            instagramCollected++;
          } catch {}
        }

        if (igErrors.length > 0) {
          results.errors.push(...igErrors.slice(0, 3));
        }
        console.log(`📷 Instagram: collected ${instagramCollected} reels`);
      } catch (err) {
        console.error('Instagram collection error:', err);
        results.errors.push('Instagram collection failed');
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        ...results,
        tiktokCollected,
        instagramCollected,
      },
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
