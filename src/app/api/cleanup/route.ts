import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Cleanup API - 비영어권 / 비상업 콘텐츠 정리
 * (해외 아이디어템 풀 전환 후 영어권 product-showcase 콘텐츠만 유지)
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

// STRONG commerce 신호 (1개라도 있어야 keep)
const COMMERCE_KEYWORDS = [
  'tiktokmademebuyit', 'tiktok made me buy', 'tiktokmademebuy',
  'amazonfinds', 'amazon finds', 'amazonmusthaves', 'amazon must haves',
  'amazonhaul', 'amazon haul', 'amazon favorite', 'amazonfavorite',
  'temufinds', 'temu finds', 'sheinfinds', 'shein finds',
  'aliexpressfinds', 'aliexpress finds', 'etsyfinds', 'etsy finds',
  'link in bio', 'link bio', 'use code', 'discount code', 'promo code',
  'on amazon', 'on etsy', 'on temu', 'on shein',
  'available now', 'available on', 'shop now', 'get yours',
  'free shipping', 'order now', 'limited time',
  'must have', 'must-have', 'must buy', 'must-buy',
  'i bought this', 'bought this', 'just bought',
  '#ad', 'sponsored by', 'gifted by', 'paid partnership',
];

const EXCLUDE_COMMERCE = [
  // 댄스 / 챌린지
  'dance','dancing','challenge','choreography','fancam',
  // 일상 / vlog
  'day in my life','day in the life','vlog','morning routine','night routine',
  'grwm','get ready with me','pov','storytime','story time','relatable',
  // 코미디 / 장난 / 패러디
  'prank','reaction','comedy','skit','funny','joke','meme','parody','roast',
  // 실험 / 사이언스
  'experiment','experiments','experimenting','science experiment','science fair',
  'what happens','what happens if','what if you',
  // 챌린지 / 지속성
  'for 30 days','for a month','for a year','for a week',
  'i tried','tried for','days of',
  // 마술 / 환상
  'magic trick','magic tricks','illusion','illusions','sleight of hand',
  // 실패
  'fail','fails','fail compilation','funny fails',
  // 호기심
  'first time trying','reacting to','reaction video','random fact',
  // 게임
  'gameplay','gaming','minecraft','fortnite','roblox','valorant',
  // 음악 / kpop
  'kpop','k-pop','jpop','j-pop','idol','cover song','singing',
  // 애니 / 만화
  'anime','manga','manhwa','webtoon','cosplay',
  // 뉴스 / 정치
  'news','politics','election',
  // 스포츠
  'football','basketball','soccer','nba','nfl','fifa',
  // ASMR / mukbang (단독)
  'mukbang','asmr eating',
];

function shouldExclude(title: string, authorName: string | null): boolean {
  // 한글 들어간 영상 제외 (해외 풀 전환)
  if (/[가-힣]/.test(title)) return true;
  // 영어가 거의 없으면 제외
  if (!/[a-zA-Z]{3,}/.test(title)) return true;
  const textToCheck = `${title} ${authorName || ''}`;
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(textToCheck))) return true;
  const lower = title.toLowerCase();
  if (EXCLUDE_COMMERCE.some(kw => lower.includes(kw))) return true;
  if (!COMMERCE_KEYWORDS.some(kw => lower.includes(kw))) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.COLLECT_API_KEY || process.env.AUTH_PASSWORD;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Step 1: 최신성 컷오프 — 2025-12-01 이전 업로드 영상 일괄 삭제
    const MIN_PUBLISHED_AT = new Date('2025-12-01T00:00:00Z');
    const oldDeleted = await prisma.video.deleteMany({
      where: { publishedAt: { lt: MIN_PUBLISHED_AT } },
    });

    // Step 2: 키워드 기반 비커머스/제외국가 영상 정리
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
      deletedOld: oldDeleted.count,
      totalVideos: allVideos.length,
      deletedKeyword: toDelete.length,
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
