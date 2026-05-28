/**
 * Gemini Vision으로 영상 썸네일을 보고 face-cam vs product-showcase 판별.
 *
 * 의뢰인 핵심 기준: "얼굴보다는 제품 위주로 영상을 찍어야 합니다"
 * 키워드/bio/댓글로는 간접 측정만 가능 — 영상 화면 자체를 직접 봐야 정확.
 *
 * 사용: GEMINI_API_KEY 환경변수 필요.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export type VisualClass = 'product' | 'face' | 'mixed';

const PROMPT = `You are looking at a thumbnail from a short-form product video (TikTok/IG Reels/YT Shorts).
Classify what is the main subject of this thumbnail.

Reply with EXACTLY one word, no punctuation:
- "product" — the thumbnail focuses on an object/product, with no person's face visible, or with only hands/torso showing
- "face" — a person's face is prominent (close-up, talking-head, selfie style); the product is secondary or absent
- "mixed" — both a person's face and a clear product are equally prominent (split screen, person holding product near face)

One word answer:`;

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { data: Buffer.from(buf).toString('base64'), mimeType };
  } catch (err) {
    console.error('fetchImageAsBase64 error:', err);
    return null;
  }
}

/**
 * 썸네일 URL을 받아 'product' | 'face' | 'mixed' 분류.
 * 실패 시 null — 호출부는 가용성 우선으로 통과시키든 스킵하든 결정.
 */
export async function classifyThumbnail(
  apiKey: string,
  thumbnailUrl: string,
): Promise<VisualClass | null> {
  if (!apiKey || !thumbnailUrl) return null;

  const image = await fetchImageAsBase64(thumbnailUrl);
  if (!image) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      { inlineData: image },
      { text: PROMPT },
    ]);

    const text = result.response.text().trim().toLowerCase();
    // 가장 첫 단어만 추출 (모델이 가끔 부가 설명 붙임)
    const firstWord = text.split(/\s|[.,;:!?]/)[0];

    if (firstWord === 'product' || firstWord === 'face' || firstWord === 'mixed') {
      return firstWord;
    }
    // 모델이 다른 단어를 뱉으면 'mixed'로 보수적 처리 (거절 안 함)
    return 'mixed';
  } catch (err) {
    console.error('Gemini classifyThumbnail error:', err);
    return null;
  }
}
