/**
 * Gemini Vision으로 영상 썸네일을 보고 face-cam vs product-showcase 판별.
 *
 * 의뢰인 핵심 기준: "얼굴보다는 제품 위주로 영상을 찍어야 합니다"
 * 키워드/bio/댓글로는 간접 측정만 가능 — 영상 화면 자체를 직접 봐야 정확.
 *
 * 사용: GEMINI_API_KEY 환경변수 필요.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PriceBand, ProductAppeal } from '@/lib/scoring';

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

// ===== v2: 제품 분석 (기준서 docs/COLLECTION_CRITERIA_V2.md §2 H5 + §3 + §4-C) =====

/**
 * 썸네일 1장으로 게이트(H5)·제외판정(§3)·제품성 점수(§4-C)에 필요한 값을 한 번에 뽑는다.
 * 항목별로 Gemini 를 여러 번 부르면 영상당 3~4콜이 되어 수집 budget 을 넘기므로
 * 단일 JSON 응답으로 받는다.
 */
export interface ProductAnalysis {
  visualClass: VisualClass;
  /** H5: 주 피사체가 물리적 제품인가 (밈/댄스/일상/서비스/앱이면 false) */
  isPhysicalProduct: boolean;
  /** 동일 제품 교차 카운트용 일반명 — 브랜드 뺀 소문자 영문 (예: "portable blender") */
  productType: string | null;
  /** §4-C: 문제해결형 / Wow-factor형 여부 */
  appeal: ProductAppeal;
  /** §4-C: 소형·경량 판단용 */
  size: 'small' | 'medium' | 'large';
  /** §4-C: 추정 소비자가 */
  priceBand: PriceBand;
  brand: string | null;
  /** §3: 빅브랜드(Apple/Nike/Dyson 등) — 유통 마진 구조상 소싱 불가 */
  isBigBrand: boolean;
  /** §3: 라이선스/IP 상품 — 정품 소싱 리스크 */
  isLicensedIp: boolean;
  /** §7: 전자·화장품·유아·식품접촉 등 국내 인증 필요 */
  isRegulated: boolean;
}

const ANALYSIS_PROMPT = `You are screening a short-form video thumbnail (TikTok/IG Reels) for a Korean import/reseller
who is looking for "winning products" to source and sell.

Answer ONLY with a JSON object with exactly these keys:
{
  "visualClass": "product" | "face" | "mixed",
  "isPhysicalProduct": boolean,
  "productType": string | null,
  "appeal": "problem_solver" | "wow" | "none",
  "size": "small" | "medium" | "large",
  "priceBand": "under_10" | "10_60" | "over_60" | "unknown",
  "brand": string | null,
  "isBigBrand": boolean,
  "isLicensedIp": boolean,
  "isRegulated": boolean
}

Definitions:
- visualClass: "product" = object is the focus, no prominent face. "face" = a person's face dominates.
  "mixed" = face and product are equally prominent.
- isPhysicalProduct: true ONLY if a tangible sellable object is the subject. false for memes, dances,
  vlogs, skits, pure lifestyle shots, apps, services, courses, digital goods.
- productType: short generic lowercase English noun phrase WITHOUT brand, e.g. "portable blender",
  "car headrest hook", "led strip light". null if not a product.
- appeal: "problem_solver" = it visibly solves an everyday annoyance (before/after, fixes a mess).
  "wow" = surprising/satisfying gimmick that makes people stop scrolling. "none" = ordinary item.
- size: physical size class. "small" = fits in a hand/bag (easy to air-ship).
  "medium" = carry with two hands. "large" = furniture/large appliance.
- priceBand: estimated US consumer price in USD.
- isBigBrand: true for major brands (Apple, Samsung, Nike, Dyson, Stanley, Sony, etc.).
- isLicensedIp: true for licensed characters/teams (Disney, Sanrio, Pokemon, sports clubs).
- isRegulated: true if Korean import would need certification — electronics/battery, cosmetics,
  skin-contact beauty devices, baby/kids items, food-contact items, supplements.

JSON only, no markdown fence:`;

const VALID_APPEAL: ProductAppeal[] = ['problem_solver', 'wow', 'none'];
const VALID_SIZE = ['small', 'medium', 'large'] as const;
const VALID_PRICE: PriceBand[] = ['under_10', '10_60', 'over_60', 'unknown'];

/**
 * 썸네일 종합 분석. 실패 시 null — 호출부(collect-gate)가 캘리브레이션 모드면
 * 통과시키고 NO_VISION 플래그를 남긴다.
 */
export async function analyzeProductThumbnail(
  apiKey: string,
  thumbnailUrl: string,
): Promise<ProductAnalysis | null> {
  if (!apiKey || !thumbnailUrl) return null;

  const image = await fetchImageAsBase64(thumbnailUrl);
  if (!image) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // flash-lite 를 쓰는 이유: 무료 티어 일일 한도가 flash 보다 크다. 수집 1회에
    // 영상당 1콜씩 나가므로 flash 로는 하루 몇 회 만에 429 로 막혀 제품 필터가
    // 통째로 무력화된다(그러면 밈/얼굴캠이 그대로 들어옴).
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent([{ inlineData: image }, { text: ANALYSIS_PROMPT }]);
    // responseMimeType 을 줘도 모델이 가끔 ```json 펜스를 붙인다
    const text = result.response.text().trim().replace(/^```(?:json)?|```$/g, '').trim();
    const raw = JSON.parse(text) as Record<string, unknown>;

    const visualClass =
      raw.visualClass === 'product' || raw.visualClass === 'face' || raw.visualClass === 'mixed'
        ? raw.visualClass
        : 'mixed';
    const appeal = VALID_APPEAL.includes(raw.appeal as ProductAppeal)
      ? (raw.appeal as ProductAppeal)
      : 'none';
    const size = (VALID_SIZE as readonly string[]).includes(raw.size as string)
      ? (raw.size as ProductAnalysis['size'])
      : 'medium';
    const priceBand = VALID_PRICE.includes(raw.priceBand as PriceBand)
      ? (raw.priceBand as PriceBand)
      : 'unknown';
    const productType =
      typeof raw.productType === 'string' && raw.productType.trim()
        ? raw.productType.trim().toLowerCase().slice(0, 60)
        : null;

    return {
      visualClass,
      isPhysicalProduct: raw.isPhysicalProduct === true,
      productType,
      appeal,
      size,
      priceBand,
      brand: typeof raw.brand === 'string' && raw.brand.trim() ? raw.brand.trim().slice(0, 40) : null,
      isBigBrand: raw.isBigBrand === true,
      isLicensedIp: raw.isLicensedIp === true,
      isRegulated: raw.isRegulated === true,
    };
  } catch (err) {
    console.error('Gemini analyzeProductThumbnail error:', err);
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
