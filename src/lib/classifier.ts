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
당신은 숏폼 비디오 분류 전문가입니다. 다음 비디오 정보를 분석하여 JSON 형식으로 분류해주세요.

비디오 정보:
- 제목: ${video.title}
- 설명: ${video.description || '없음'}
- 해시태그: ${video.tags?.join(', ') || '없음'}
- 제작자: ${video.authorName || '알 수 없음'}

다음 형식으로 JSON만 반환해주세요 (다른 텍스트 없이):
{
  "category": "카테고리",
  "targetAge": "연령대",
  "tags": ["관련", "태그", "목록"],
  "confidence": 0.0-1.0
}

카테고리 옵션:
- BEAUTY: 뷰티, 화장품, 스킨케어, 메이크업
- FOOD: 음식, 요리, 레시피, 먹방
- FASHION: 패션, 의류, 코디, OOTD
- ELECTRONICS: 전자기기, 가젯, 테크 리뷰
- LIFESTYLE: 라이프스타일, 일상, 인테리어, VLOG
- HEALTH: 건강, 운동, 피트니스, 다이어트
- KIDS: 육아, 키즈, 장난감, 아기
- OTHER: 기타

연령대 옵션:
- 10s: 10대 (청소년)
- 20s: 20대 (청년층)
- 30s: 30대
- 40s: 40대
- 50s+: 50대 이상

JSON 응답만 출력하세요:
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
    return {
      category: 'OTHER',
      targetAge: '20s',
      tags: [],
      confidence: 0,
    };
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

  const categoryKeywords: Record<Category, string[]> = {
    BEAUTY: ['뷰티', '메이크업', '화장', '스킨케어', 'beauty', 'makeup', '립스틱', '파운데이션'],
    FOOD: ['먹방', '요리', '레시피', '음식', 'food', 'cooking', '맛집', '푸드'],
    FASHION: ['패션', '코디', 'ootd', '옷', 'fashion', 'outfit', '스타일', '룩북'],
    ELECTRONICS: ['가젯', '전자', '테크', 'tech', 'gadget', '리뷰', '언박싱', 'unboxing'],
    LIFESTYLE: ['일상', 'vlog', '라이프', '인테리어', 'lifestyle', '브이로그', '루틴'],
    HEALTH: ['운동', '헬스', '다이어트', '피트니스', 'fitness', 'workout', '건강'],
    KIDS: ['육아', '키즈', '아기', '장난감', 'kids', 'baby', '유아', 'toy'],
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
