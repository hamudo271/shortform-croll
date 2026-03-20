/**
 * AI 분석 모듈 - 트렌드 예측, 상품 감지, 감성 분석
 * Gemini API 사용
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

interface VideoData {
  title: string;
  description?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  authorName?: string;
}

export interface AIAnalysis {
  trendScore: number;        // 0~100, 곧 터질 확률
  trendReason: string;       // 예측 근거
  products: string[];        // 감지된 상품/브랜드
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;    // 0~100
  buyingIntent: number;      // 0~100, 구매 의도 점수
  summary: string;           // 한줄 요약
}

/**
 * 수학 기반 트렌드 점수 (AI 없이 빠르게)
 */
export function calculateTrendScore(video: VideoData): number {
  const { viewCount, likeCount, commentCount } = video;

  // 참여율 (좋아요+댓글 / 조회수)
  const engagement = viewCount > 0
    ? ((likeCount + commentCount) / viewCount) * 100
    : 0;

  // 댓글 비율 (댓글이 많으면 토론/관심이 높음)
  const commentRatio = viewCount > 0
    ? (commentCount / viewCount) * 1000
    : 0;

  // 점수 계산
  let score = 0;

  // 참여율 5% 이상이면 높은 점수
  if (engagement > 10) score += 40;
  else if (engagement > 5) score += 30;
  else if (engagement > 2) score += 20;
  else score += 10;

  // 댓글 비율
  if (commentRatio > 5) score += 20;
  else if (commentRatio > 2) score += 15;
  else if (commentRatio > 1) score += 10;

  // 조회수 자체 (이미 터진 정도)
  if (viewCount > 5000000) score += 30;
  else if (viewCount > 1000000) score += 25;
  else if (viewCount > 500000) score += 20;
  else if (viewCount > 100000) score += 15;
  else score += 5;

  return Math.min(100, score);
}

/**
 * 키워드 기반 상품 감지 (빠른 버전)
 */
export function detectProducts(title: string): string[] {
  const products: string[] = [];

  // 브랜드 패턴
  const brands = [
    '올리브영', '다이소', '쿠팡', '무신사', '알리', '테무',
    '나이키', '아디다스', '뉴발란스', '컨버스',
    '샤넬', '프라다', '구찌', '루이비통', '디올',
    '아이폰', '갤럭시', '맥북', '에어팟', '아이패드',
    '다이슨', '필립스', '삼성', '엘지', 'LG',
    '이니스프리', '롬앤', '어뮤즈', '클리오', '에뛰드',
    '스타벅스', '투썸', '메가커피', '컴포즈',
    '팝마트', '레고', '닌텐도', '플레이스테이션',
  ];

  for (const brand of brands) {
    if (title.includes(brand)) {
      products.push(brand);
    }
  }

  // 상품 카테고리 패턴
  const categoryPatterns: [RegExp, string][] = [
    [/베개|쿠션|매트리스/, '침구류'],
    [/세럼|크림|로션|선크림/, '스킨케어'],
    [/립|틴트|파운데이션|마스카라/, '메이크업'],
    [/향수|퍼퓸|바디미스트/, '향수'],
    [/케이스|필름|거치대/, '폰악세사리'],
    [/이어폰|헤드폰|스피커/, '음향기기'],
    [/키보드|마우스|모니터/, 'PC주변기기'],
    [/가방|백팩|크로스백|토트백/, '가방'],
    [/운동화|스니커즈|슬리퍼/, '신발'],
    [/반찬|도시락|밀키트/, '식품'],
  ];

  for (const [pattern, category] of categoryPatterns) {
    if (pattern.test(title)) {
      products.push(category);
    }
  }

  return [...new Set(products)];
}

/**
 * 감성 분석 (키워드 기반 빠른 버전)
 */
export function analyzeSentiment(title: string, engagement: number): {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
} {
  const positiveWords = [
    '추천', '최고', '대박', '꿀', '갓', '미쳤', '인생', '진짜',
    '꼭', '필수', '사세요', '강추', '존맛', '존예', '개이득',
    '혜자', 'best', '완벽', '만족',
  ];

  const negativeWords = [
    '별로', '후회', '환불', '실망', '쓰레기', '최악', '거르',
    '비추', '폭망', '노잼',
  ];

  let positiveCount = 0;
  let negativeCount = 0;
  const lower = title.toLowerCase();

  for (const word of positiveWords) {
    if (lower.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) negativeCount++;
  }

  // 참여율도 반영 (참여율 높으면 긍정적)
  const engagementBonus = engagement > 5 ? 15 : engagement > 2 ? 10 : 0;

  const score = Math.min(100, 50 + (positiveCount * 15) - (negativeCount * 20) + engagementBonus);

  return {
    sentiment: score > 65 ? 'positive' : score < 35 ? 'negative' : 'neutral',
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * 구매 의도 점수
 */
export function calculateBuyingIntent(title: string, viewCount: number, engagement: number): number {
  let score = 0;

  // 구매 유도 키워드
  const buyingKeywords = [
    '구매', '링크', '사세요', '사야', '필수템', '꼭', '득템',
    '할인', '세일', '특가', '핫딜', '쿠폰',
    '언박싱', '하울', '후기', '리뷰', '비교',
    '광고', '협찬', 'ad',
  ];

  const lower = title.toLowerCase();
  for (const kw of buyingKeywords) {
    if (lower.includes(kw)) score += 10;
  }

  // 참여율 높으면 관심이 많다는 뜻
  if (engagement > 5) score += 20;
  else if (engagement > 2) score += 10;

  // 조회수 높으면 보너스
  if (viewCount > 1000000) score += 15;
  else if (viewCount > 100000) score += 10;

  return Math.min(100, score);
}

/**
 * Gemini AI를 사용한 심층 분석 (선택적)
 */
export async function analyzeWithAI(
  geminiKey: string,
  video: VideoData,
): Promise<AIAnalysis | null> {
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `당신은 한국 이커머스/유통 전문가입니다. 아래 바이럴 영상을 분석해주세요.

제목: ${video.title}
설명: ${video.description || '없음'}
작성자: ${video.authorName || '알 수 없음'}
조회수: ${video.viewCount.toLocaleString()}
좋아요: ${video.likeCount.toLocaleString()}
댓글: ${video.commentCount.toLocaleString()}

다음을 JSON으로 답변해주세요 (다른 텍스트 없이 순수 JSON만):
{
  "trendScore": (0~100, 앞으로 더 터질 가능성),
  "trendReason": "(한국어로 1문장, 예측 근거)",
  "products": ["감지된 상품/브랜드명 배열"],
  "sentiment": "positive 또는 neutral 또는 negative",
  "sentimentScore": (0~100),
  "buyingIntent": (0~100, 이 영상 본 사람이 실제 구매할 확률),
  "summary": "(한국어 1문장, 유통업자에게 유용한 인사이트)"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as AIAnalysis;
  } catch (error) {
    console.error('AI analysis error:', error);
    return null;
  }
}

/**
 * 빠른 분석 (AI 없이, 모든 영상에 적용)
 */
export function quickAnalysis(video: VideoData): AIAnalysis {
  const engagement = video.viewCount > 0
    ? ((video.likeCount + video.commentCount) / video.viewCount) * 100
    : 0;

  const trendScore = calculateTrendScore(video);
  const products = detectProducts(video.title);
  const { sentiment, score: sentimentScore } = analyzeSentiment(video.title, engagement);
  const buyingIntent = calculateBuyingIntent(video.title, video.viewCount, engagement);

  let trendReason = '';
  if (trendScore >= 70) trendReason = '높은 참여율과 조회수로 바이럴 가능성 높음';
  else if (trendScore >= 50) trendReason = '관심도가 상승 중인 콘텐츠';
  else trendReason = '안정적인 조회 패턴';

  return {
    trendScore,
    trendReason,
    products,
    sentiment,
    sentimentScore,
    buyingIntent,
    summary: products.length > 0
      ? `${products.join(', ')} 관련 콘텐츠 - 구매 의도 ${buyingIntent}%`
      : `참여율 ${engagement.toFixed(1)}% - 트렌드 점수 ${trendScore}`,
  };
}