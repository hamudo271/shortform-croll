/**
 * Gemini API Video Classifier
 * Automatically categorizes videos and estimates target audience
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export type Category =
  | 'BEAUTY'
  | 'FOOD'
  | 'FASHION'
  | 'ELECTRONICS'
  | 'LIFESTYLE'
  | 'HEALTH'
  | 'KIDS'
  | 'OTHER';

export type TargetAge = '10s' | '20s' | '30s' | '40s' | '50s+';

interface ClassificationResult {
  category: Category;
  targetAge: TargetAge;
  tags: string[];
  confidence: number;
}

interface VideoInput {
  title: string;
  description?: string;
  tags?: string[];
  authorName?: string;
}

/**
 * Initialize Gemini API client
 */
function getGeminiClient(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Try using 'gemini-1.5-flash' which is the standard model name
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

/**
 * Classify a single video
 */
export async function classifyVideo(
  apiKey: string,
  video: VideoInput
): Promise<ClassificationResult> {
  const model = getGeminiClient(apiKey);

  const prompt = `
당신은 유통업을 위한 바이럴 상품 분석가입니다. 이 영상이 "판매할 수 있는 상품"을 소개하는지 분석해주세요.

비디오 정보:
- 제목: ${video.title}
- 설명: ${video.description || '없음'}
- 해시태그: ${video.tags?.join(', ') || '없음'}
- 제작자: ${video.authorName || '알 수 없음'}

핵심 질문: 이 영상에서 소개하는 "구매 가능한 상품"이 있는가?

JSON 형식으로 반환 (다른 텍스트 없이):
{
  "category": "상품 카테고리",
  "targetAge": "타겟 연령대",
  "tags": ["상품명", "브랜드", "특징"],
  "confidence": 0.0-1.0
}

카테고리 (상품 유형 기준):
- BEAUTY: 화장품, 스킨케어, 뷰티 도구, 향수
- FOOD: 식품, 간식, 음료, 건강식품, 다이어트 식품
- FASHION: 의류, 신발, 가방, 악세사리, 주얼리
- ELECTRONICS: 전자기기, 폰케이스, 충전기, 이어폰, 가젯
- LIFESTYLE: 생활용품, 주방용품, 인테리어 소품, 수납용품
- HEALTH: 건강용품, 운동기구, 마사지기, 자세교정
- KIDS: 유아용품, 장난감, 아동복, 교육용품
- OTHER: 상품이 아니거나 분류 불가

중요: 상품 리뷰/언박싱/추천 영상이 아니면 OTHER로 분류하세요.

연령대: 10s, 20s, 30s, 40s, 50s+

tags에는 영상에서 소개하는 구체적인 상품명이나 상품 특징을 넣으세요.

JSON 응답만:
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and return
    return {
      category: validateCategory(parsed.category),
      targetAge: validateTargetAge(parsed.targetAge),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch (error) {
    console.error('Classification error:', error);
    // Fallback to keyword-based classification on API error
    return classifyByKeywords(video);
  }
}

/**
 * Batch classify multiple videos
 */
export async function classifyVideos(
  apiKey: string,
  videos: VideoInput[]
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];

  // Process in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map((video) => classifyVideo(apiKey, video))
    );

    results.push(...batchResults);

    // Rate limiting delay (Gemini free tier: 60 requests/minute)
    if (i + batchSize < videos.length) {
      await delay(1000);
    }
  }

  return results;
}

/**
 * Validate category value
 */
function validateCategory(value: string): Category {
  const validCategories: Category[] = [
    'BEAUTY',
    'FOOD',
    'FASHION',
    'ELECTRONICS',
    'LIFESTYLE',
    'HEALTH',
    'KIDS',
    'OTHER',
  ];

  const upper = value?.toUpperCase() as Category;
  return validCategories.includes(upper) ? upper : 'OTHER';
}

/**
 * Validate target age value
 */
function validateTargetAge(value: string): TargetAge {
  const validAges: TargetAge[] = ['10s', '20s', '30s', '40s', '50s+'];

  const normalized = value?.toLowerCase();

  // Handle various input formats
  if (normalized?.includes('10') || normalized?.includes('teen')) return '10s';
  if (normalized?.includes('20')) return '20s';
  if (normalized?.includes('30')) return '30s';
  if (normalized?.includes('40')) return '40s';
  if (normalized?.includes('50') || normalized?.includes('+')) return '50s+';

  return validAges.includes(value as TargetAge) ? (value as TargetAge) : '20s';
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simple keyword-based classification (fallback when API unavailable)
 */
export function classifyByKeywords(video: VideoInput): ClassificationResult {
  const text = `${video.title} ${video.description || ''} ${video.tags?.join(' ') || ''}`.toLowerCase();

  // 상품 중심 키워드 (유통업 목적)
  const categoryKeywords: Record<Category, string[]> = {
    BEAUTY: ['화장품', '스킨케어', '올리브영', '뷰티템', '파운데이션', '립', '세럼', 'skincare', 'makeup'],
    FOOD: ['식품', '간식', '음료', '건강식품', '다이어트', '영양제', '단백질', 'snack', 'supplement'],
    FASHION: ['옷', '하울', '악세사리', '가방', '신발', '주얼리', 'haul', 'fashion', 'outfit'],
    ELECTRONICS: ['가젯', '충전기', '이어폰', '폰케이스', '언박싱', 'unboxing', 'gadget', 'tech', '전자기기'],
    LIFESTYLE: ['생활용품', '주방', '인테리어', '수납', '다이소', '꿀템', '추천템', 'home', 'kitchen'],
    HEALTH: ['운동기구', '마사지', '자세교정', '헬스', '홈트', 'fitness', 'massage', '건강용품'],
    KIDS: ['장난감', '유아용품', '아동복', '교육용품', 'toy', 'kids', '육아템', '아기용품'],
    OTHER: [],
  };

  let bestCategory: Category = 'OTHER';
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const matches = keywords.filter((kw) => text.includes(kw)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category as Category;
    }
  }

  // Estimate target age based on content
  let targetAge: TargetAge = '20s';
  if (text.match(/10대|teen|학생|고등/)) targetAge = '10s';
  else if (text.match(/30대|직장인|결혼|주부/)) targetAge = '30s';
  else if (text.match(/40대|중년/)) targetAge = '40s';
  else if (text.match(/50대|시니어|은퇴/)) targetAge = '50s+';

  return {
    category: bestCategory,
    targetAge,
    tags: [],
    confidence: maxMatches > 0 ? 0.6 : 0.3,
  };
}
