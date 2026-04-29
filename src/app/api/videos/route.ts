import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Platform, Category } from '@prisma/client';

// 인도/동남아 제외 패턴 (앱 레벨 필터)
const EXCLUDE_PATTERNS = [
  /[\u0900-\u097F]/, // Hindi
  /[\u0980-\u09FF]/, // Bengali
  /[\u0B80-\u0BFF]/, // Tamil
  /[\u0C00-\u0C7F]/, // Telugu
  /[\u0C80-\u0CFF]/, // Kannada
  /[\u0D00-\u0D7F]/, // Malayalam
  /[\u0E00-\u0E7F]/, // Thai
  /[\u0600-\u06FF]/, // Arabic
  /\b(india|indian|hindi|desi|pakistan|bangladesh|tamil|telugu|indonesia|thai|pinoy|filipino|vietnam)\b/i,
];

function isExcluded(title: string, authorName: string | null): boolean {
  const text = `${title} ${authorName || ''}`;
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(text));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const platform = searchParams.get('platform') as Platform | null;
    const category = searchParams.get('category') as Category | null;
    const targetAge = searchParams.get('targetAge');
    const sortBy = searchParams.get('sortBy') || 'viralScore';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search');
    const days = parseInt(searchParams.get('days') || '30', 10);
    const country = searchParams.get('country');

    // Filter by collection date
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(platform && { platform }),
      ...(category && { category }),
      ...(targetAge && { targetAge }),
      ...(country && { country }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
      collectedAt: { gte: dateThreshold },
    };

    // Build orderBy
    type OrderByField = 'viralScore' | 'viewCount' | 'likeCount' | 'collectedAt';
    const orderByMap: Record<OrderByField, { [key: string]: 'desc' }> = {
      viralScore: { viralScore: 'desc' },
      viewCount: { viewCount: 'desc' },
      likeCount: { likeCount: 'desc' },
      collectedAt: { collectedAt: 'desc' },
    };

    const orderBy = orderByMap[sortBy as OrderByField] || orderByMap.viralScore;

    // Overfetch to account for post-query filtering
    const overfetchLimit = limit * 3;
    const [rawVideos, rawTotal] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy,
        take: overfetchLimit,
        skip: offset,
      }),
      prisma.video.count({ where }),
    ]);

    // 비영어권 비서구 콘텐츠 제외 (인도/태국/베트남/아랍어 등)
    const filteredVideos = rawVideos
      .filter(v => !isExcluded(v.title, v.authorName))
      .slice(0, limit)
      .map(video => ({
        ...video,
        viewCount: Number(video.viewCount),
        likeCount: Number(video.likeCount),
        shareCount: Number(video.shareCount),
        commentCount: Number(video.commentCount),
      }));

    const res = NextResponse.json({
      videos: filteredVideos,
      total: rawTotal,
      limit,
      offset,
    });
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch videos',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      platform,
      videoId,
      title,
      description,
      thumbnailUrl,
      videoUrl,
      authorName,
      authorUrl,
      viewCount,
      likeCount,
      shareCount,
      commentCount,
      category,
      targetAge,
      tags,
      publishedAt,
      country,
    } = body;

    // Upsert video (update if exists, create if not)
    const video = await prisma.video.upsert({
      where: { videoId },
      update: {
        title,
        description,
        thumbnailUrl,
        viewCount: BigInt(viewCount || 0),
        likeCount: BigInt(likeCount || 0),
        shareCount: BigInt(shareCount || 0),
        commentCount: BigInt(commentCount || 0),
        category,
        targetAge,
        tags,
        country,
        updatedAt: new Date(),
      },
      create: {
        platform,
        videoId,
        title,
        description,
        thumbnailUrl,
        videoUrl,
        authorName,
        authorUrl,
        viewCount: BigInt(viewCount || 0),
        likeCount: BigInt(likeCount || 0),
        shareCount: BigInt(shareCount || 0),
        commentCount: BigInt(commentCount || 0),
        category,
        targetAge,
        tags: tags || [],
        country,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      },
    });

    return NextResponse.json({
      ...video,
      viewCount: Number(video.viewCount),
      likeCount: Number(video.likeCount),
      shareCount: Number(video.shareCount),
      commentCount: Number(video.commentCount),
    });
  } catch (error) {
    console.error('Error creating/updating video:', error);
    return NextResponse.json(
      { error: 'Failed to create/update video' },
      { status: 500 }
    );
  }
}
