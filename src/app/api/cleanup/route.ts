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

const COMMERCE_KEYWORDS = [
  '추천','꿀템','리뷰','언박싱','하울','신상','가성비','구매','제품','상품',
  '사용','후기','비교','순위','베스트','할인','세일','특가','핫딜',
  '쿠팡','다이소','올리브영','알리','직구','맛집','레시피',
  '인테리어','소품','용품','화장품','스킨케어','메이크업','향수','뷰티',
  '패션','코디','데일리룩','악세사리','가방','신발','옷',
  '주방','생활','전자','가젯','폰케이스','이어폰',
  '다이어트','영양제','건강','운동','홈트','캠핑','차박','여행','호텔',
  '육아','아기','반려','강아지','고양이','편의점','카페','디저트','빵','음식',
  '브랜드','명품','나이키','아디다스','팝마트','레고','피규어','굿즈',
  '광고','협찬','링크',
];

const EXCLUDE_COMMERCE = [
  '챌린지','challenge','댄스','dance','커플','남친','여친',
  '학교','학생','군대','게임','롤','배그','game',
  '팬캠','fancam','직캠','콘서트','드라마','영화','스포',
  '웃긴','몰카','prank','반응',
  'manhwa','manga','만화','웹툰','bl','fyp','foryoupage',
  'anime','애니',
  '오락실','예능','방송','프로그램','클립','편집',
  '런닝맨','나혼자산다','놀면뭐하니','지구오락실','출장십오야',
  '아이돌','데뷔','컴백','엠카','뮤뱅','음방',
  '연예인','배우','가수','kpop','k-pop','idol',
  '뉴스','정치','대통령','국회','선거',
  '축구','야구','농구','올림픽','월드컵',
];

function shouldExclude(title: string, authorName: string | null): boolean {
  if (!/[가-힣]/.test(title)) return true;
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
