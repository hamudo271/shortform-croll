import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { quickAnalysis, analyzeWithAI } from '@/lib/ai-analysis';

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('id');
  const deep = request.nextUrl.searchParams.get('deep') === 'true';

  if (!videoId) {
    return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
  }

  try {
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const videoData = {
      title: video.title,
      description: video.description || '',
      viewCount: Number(video.viewCount),
      likeCount: Number(video.likeCount),
      commentCount: Number(video.commentCount),
      authorName: video.authorName || '',
    };

    // 빠른 분석 (항상)
    const quick = quickAnalysis(videoData);

    // 심층 AI 분석 (요청 시)
    let aiResult = null;
    if (deep && process.env.GEMINI_API_KEY) {
      aiResult = await analyzeWithAI(process.env.GEMINI_API_KEY, videoData);
    }

    const res = NextResponse.json({
      videoId: video.id,
      title: video.title,
      analysis: aiResult || quick,
      isAI: !!aiResult,
    });
    res.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Analysis failed', details: String(error) }, { status: 500 });
  }
}