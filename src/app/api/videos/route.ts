import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Platform, Category } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const platform = searchParams.get('platform') as Platform | null;
    const category = searchParams.get('category') as Category | null;
    const targetAge = searchParams.get('targetAge');
    const sortBy = searchParams.get('sortBy') || 'viralScore';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search');
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Build where clause
    const where: {
      platform?: Platform;
      category?: Category;
      targetAge?: string;
      title?: { contains: string; mode: 'insensitive' };
      collectedAt?: { gte: Date };
    } = {};

    if (platform) {
      where.platform = platform;
    }

    if (category) {
      where.category = category;
    }

    if (targetAge) {
      where.targetAge = targetAge;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Filter by collection date
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    where.collectedAt = { gte: dateThreshold };

    // Build orderBy
    type OrderByField = 'viralScore' | 'viewCount' | 'likeCount' | 'collectedAt';
    const orderByMap: Record<OrderByField, { [key: string]: 'desc' }> = {
      viralScore: { viralScore: 'desc' },
      viewCount: { viewCount: 'desc' },
      likeCount: { likeCount: 'desc' },
      collectedAt: { collectedAt: 'desc' },
    };

    const orderBy = orderByMap[sortBy as OrderByField] || orderByMap.viralScore;

    // Fetch videos
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.video.count({ where }),
    ]);

    // Transform BigInt to number for JSON serialization
    const transformedVideos = videos.map((video) => ({
      ...video,
      viewCount: Number(video.viewCount),
      likeCount: Number(video.likeCount),
      shareCount: Number(video.shareCount),
      commentCount: Number(video.commentCount),
    }));

    return NextResponse.json({
      videos: transformedVideos,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
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
