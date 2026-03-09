import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Cleanup API - 인도/동남아 등 제외 국가 영상 삭제
 */

// 제외할 패턴들
const EXCLUDE_PATTERNS = [
  // 힌디어/인도어 문자
  /[\u0900-\u097F]/, // Devanagari (Hindi)
  /[\u0980-\u09FF]/, // Bengali
  /[\u0A00-\u0A7F]/, // Gurmukhi (Punjabi)
  /[\u0A80-\u0AFF]/, // Gujarati
  /[\u0B00-\u0B7F]/, // Oriya
  /[\u0B80-\u0BFF]/, // Tamil
  /[\u0C00-\u0C7F]/, // Telugu
  /[\u0C80-\u0CFF]/, // Kannada
  /[\u0D00-\u0D7F]/, // Malayalam
  // 태국어
  /[\u0E00-\u0E7F]/, // Thai
  // 베트남어
  /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i,
  // 아랍어
  /[\u0600-\u06FF]/, // Arabic
  // 키워드 기반
  /\b(india|indian|hindi|desi|pakistan|bangladesh|tamil|telugu|malayalam|kannada|marathi)\b/i,
  /\b(indonesia|indonesian|vietnamese|vietnam|thailand|thai|pinoy|filipino|philippines)\b/i,
  /\b(malaysia|malay|singapore|singapura)\b/i,
];

function shouldExclude(title: string, authorName: string | null): boolean {
  const textToCheck = `${title} ${authorName || ''}`;
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(textToCheck));
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 모든 비디오 가져오기
    const allVideos = await prisma.video.findMany({
      select: {
        id: true,
        title: true,
        authorName: true,
      },
    });

    const toDelete: string[] = [];

    for (const video of allVideos) {
      if (shouldExclude(video.title, video.authorName)) {
        toDelete.push(video.id);
      }
    }

    // 삭제 실행
    if (toDelete.length > 0) {
      await prisma.video.deleteMany({
        where: {
          id: { in: toDelete },
        },
      });
    }

    return NextResponse.json({
      success: true,
      totalVideos: allVideos.length,
      deletedCount: toDelete.length,
      remainingCount: allVideos.length - toDelete.length,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 제외 대상 영상 개수 미리보기
    const allVideos = await prisma.video.findMany({
      select: {
        id: true,
        title: true,
        authorName: true,
      },
    });

    let excludeCount = 0;
    const excludeExamples: string[] = [];

    for (const video of allVideos) {
      if (shouldExclude(video.title, video.authorName)) {
        excludeCount++;
        if (excludeExamples.length < 10) {
          excludeExamples.push(video.title.substring(0, 50));
        }
      }
    }

    return NextResponse.json({
      totalVideos: allVideos.length,
      toBeDeleted: excludeCount,
      remaining: allVideos.length - excludeCount,
      examples: excludeExamples,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
