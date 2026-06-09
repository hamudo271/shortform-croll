/**
 * Creator profile cache + sales-link 추론.
 *
 * 영상 작성자의 프로필을 7일 TTL로 캐시.
 * `hasSalesLink`는 (1) bio에 외부 URL 존재 또는 (2) signature에 commerce 시그널이
 * 보이면 true.
 */

import { prisma } from '@/lib/prisma';
import type { Creator, Platform } from '@prisma/client';

export const CREATOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 셀러로 운영 중인 계정의 bio URL 패턴.
// 일반 SNS 링크(instagram.com/, twitter.com/, youtube.com/, linkedin.com/)는 거름.
// 통과 조건: link-in-bio 어그리게이터, 직접 커머스 호스트, 또는 Amazon storefront.
const SALES_HOST_RE = new RegExp(
  [
    // link-in-bio 어그리게이터
    'linktr\\.ee',
    'linktree\\.com',
    'lnk\\.bio',
    'bio\\.site',
    'beacons\\.ai',
    'beacons\\.page',
    'stan\\.store',
    'sprout\\.link',
    'linkin\\.bio',
    'milkshake\\.app',
    'campsite\\.bio',
    'snipfeed\\.co',
    'koji\\.to',
    'shor\\.by',
    'hoo\\.be',
    'taplink\\.net',
    'taplink\\.cc',
    'flow\\.page',
    'allmylinks\\.com',
    'about\\.me',
    'carrd\\.co',
    'pillar\\.io',
    'magic\\.link',
    'msha\\.ke',
    'solo\\.to',
    'withkoji\\.com',
    // Amazon storefront / affiliate
    'amazon\\.com/shop',
    'amzn\\.to',
    'a\\.co/',
    'amazon\\.com/[^/]*store',
    // 직접 커머스
    'shopify\\.com',
    'myshopify\\.com',
    'etsy\\.com',
    'gumroad\\.com',
    'ko-fi\\.com',
    'kofi\\.com',
    'bigcartel\\.com',
    'square\\.site',
    'squarespace\\.com',
    'wix\\.com',
    'webflow\\.io',
    'cargo\\.site',
    // TikTok shop / YouTube shop
    'tiktok\\.com/shop',
    'tiktokshop',
    'youtube\\.com/shop',
    // 단축 URL (자주 셀러용)
    'bit\\.ly',
    'shorturl\\.at',
    // Temu / Shein affiliate
    'temu\\.com',
    'shein\\.com',
  ].join('|'),
  'i',
);

// 일반 SNS — 이거만 있으면 셀러로 안 침
// tiktok 프로필(tiktok.com/@user)도 '판매 링크' 아님 — 단, tiktok.com/shop 은
// SALES_HOST_RE 가 먼저 매치하므로 정상 통과. (의뢰인 ③: 프로필에 '구매' 링크 필수)
const NON_SALES_HOST_RE = /^https?:\/\/(www\.)?(instagram|facebook|fb|twitter|x|youtube|youtu|linkedin|pinterest|tumblr|threads|snapchat|tiktok|t)\.(com|net|me|be)\b/i;

// signature 안에 명시적으로 셀러임을 알리는 텍스트
const SIG_COMMERCE = new RegExp(
  [
    'linktr\\.ee', 'linktree', 'beacons', 'stan\\.store', 'lnk\\.bio',
    'bio\\.site', 'sprout\\.link',
    'amazon\\.com/shop', 'amzn\\.to', 'a\\.co/',
    'shopify', 'myshopify', 'etsy', 'gumroad', 'ko-fi', 'kofi',
    'tiktok\\.com/shop', 'tiktokshop',
    // 명시적 안내 문구
    'link in bio', 'link below', 'shop now', 'shop link',
    'buy link', 'order now', 'use code',
    'available on amazon', 'available on etsy', 'available on temu',
    'my store', 'my shop',
    // 이모지 + 어그리게이터/커머스 단어 페어
    '\\bshop\\b.*👇', '👇.*\\bshop\\b',
    '🛒', '🔗.*shop', 'shop.*🔗',
  ].join('|'),
  'i',
);

export function computeHasSalesLink(
  bioUrl?: string | null,
  signature?: string | null,
): boolean {
  // 1) bioUrl이 셀러 호스트면 통과
  if (bioUrl && bioUrl.length > 5) {
    if (SALES_HOST_RE.test(bioUrl)) return true;
    // 단순 SNS 링크면 절대 통과 안 함
    if (NON_SALES_HOST_RE.test(bioUrl)) return false;
    // 그 외 (개인 블로그/자체 도메인) — signature가 명시적 셀러 시그널 가져야만 통과
  }
  // 2) signature가 명시적 셀러 시그널을 포함하면 통과
  if (signature && SIG_COMMERCE.test(signature)) return true;
  return false;
}

// 개인 lifestyle/얼굴 위주 계정의 시그널.
// "I'm obsessed with girly things", "motherhood | daily life",
// "lifestyle creator", "my journey" 등 1인칭/감정 표현이 박혀있으면
// 셀러보다는 인플루언서/일상 채널일 확률이 높음.
const PERSONAL_BIO_RE = new RegExp(
  [
    'content creator',
    'lifestyle creator',
    'tech.{0,5}lifestyle',
    'motherhood',
    'mama',
    'my journey',
    "i'?m obsessed",
    "i'?m a (?!seller|shop)",
    'daily life',
    'my happy place',
    'my world',
    'my heart',
    "girly\\s+things",
    "girlies",
    'personality',
    "i\\s+yap",
    'partnerships?@',
  ].join('|'),
  'i',
);

// 핸들에 "finds/shop/store/deals/products/gadget/...": 셀러 핸들 패턴 (개인 lifestyle을 우회 통과)
const SELLER_HANDLE_RE = /finds?|\bshop|store|deals|official|products?|hauls?\b|gadget|favorite|picks|amazon|temu|ali/i;

// 인도 영어 채널 패턴 — 운영자가 "해외 아이디어템 가젯" 풀을 원하는데, 인도 화장품/뷰티
// 채널들이 영어 검색에 다수 잡힘. 채널 이름 / 시그너처 어디든 매치되면 거부.
//
// 검증된 사례: VEER G COSMETICS, Satpal Singh, Fiza Makeup Academy,
// Parlour Makeup Box 등 — 의뢰인이 원하는 톤(Daily Sunbeam, CozyPrime Finds 류)과 다름.
const INDIAN_CONTENT_RE = new RegExp(
  [
    // 채널명 패턴
    'cosmetics\\b',
    'makeup academy',
    'beauty parlour',
    'parlour makeup',
    'mehndi',
    'bridal makeup',
    'bridal look',
    'dulhan',
    'salon shorts',
    // 인도 빈출 channel suffix
    'beauty tips',
    'beauty world',
    'beauty studio',
  ].join('|'),
  'i',
);

// 데바나가리 (힌디/마라티 등 인도 문자) 매치
const DEVANAGARI_RE = /[ऀ-ॿ]/;

export function isLikelyIndianContent(
  authorId?: string | null,
  signature?: string | null,
): boolean {
  const text = `${authorId || ''} ${signature || ''}`;
  if (DEVANAGARI_RE.test(text)) return true;
  if (INDIAN_CONTENT_RE.test(text)) return true;
  return false;
}

// 일관된 컨텐츠 = 셀러: 일정 수 이상의 영상이 누적돼야 함 (1회성 광고 인플루언서 거름)
// 의뢰인 ① 강화: 50 → 100 이었으나 풀이 너무 좁아져서 75로 살짝 완화
// (시그너처/핸들 양쪽 조건 다 봐서 quality는 유지)
const MIN_VIDEO_COUNT_FOR_SELLER = 75;

// 시그너처에 명시적 셀러 자기소개 — "그냥 bio에 linktree 있는 사람" vs
// "본인이 셀러임을 자칭하는 계정"을 구분. 의뢰인 ① 일관성 기준의 핵심 시그널.
//
// 검증된 A티어 사례:
//   Daily Sunbeam: "👇 Buy Link 👇"
//   CozyPrime: "Shop my top picks"
//   Sam Shan Shops: "AMAZON FINDS 💌"
//   Anya: "Shop My Videos Here ✨"
//   theproducthome: "Shop my links 👇"
//
// (tikwm /api/user/posts 가 Cloudflare 403 차단되어 최근 영상 직접 분석은 불가 —
//  자기소개 매칭이 차선책 중 가장 강한 시그널)
const STRONG_SELLER_SIG_RE = new RegExp(
  [
    // 명시적 셀러 멘트
    'buy link',
    'buy all',
    'shop my',
    'shop here',
    'shop the link',
    'product link',
    'links? (below|here|in bio)',
    'find(s)? here',
    // 카테고리 키워드 (셀러 자기소개에 흔히 등장)
    'amazon finds',
    'amazon gems',
    'amazon must.?haves',
    'best amazon',
    'daily amazon',
    'all (my )?(product )?(links|finds)',
    'click (down below|the link)',
    'my (amazon )?storefront',
    'tiktok shop',
    'curated.{0,30}products',
    'daily.{0,20}finds',
    'every.{0,20}finds',
    'fast (us )?shipping',
    // 셀러 이모지
    '🛒',
    // 가젯/리뷰 큐레이션 자기소개
    'daily.{0,15}gadgets',
    'viral.{0,15}gadgets',
    'cool inventions',
    'trending products',
    'sourcing tips',
  ].join('|'),
  'i',
);

export interface QualifiedSellerSignals {
  authorId?: string | null;
  bioUrl?: string | null;
  signature?: string | null;
  videoCount?: number | null;
}

/**
 * 영상 수집 게이트의 최종 셀러 판정.
 * - hasSalesLink (commerce host) ✅
 * - 개인 lifestyle 패턴 거부 (단, 셀러 핸들 패턴이면 살림)
 * - videoCount ≥ 50 (제품 위주로 꾸준히 올리는 계정)
 * - videoCount 미상(null/undefined)인 경우는 신뢰 (예: 일부 플랫폼 응답 누락)
 */
export function isQualifiedSeller({
  authorId,
  bioUrl,
  signature,
  videoCount,
}: QualifiedSellerSignals): boolean {
  if (!computeHasSalesLink(bioUrl, signature)) return false;

  // 인도 영어 화장품/뷰티 채널 거부 — 의뢰인이 원하는 "해외 아이디어템" 톤과 다름
  if (isLikelyIndianContent(authorId, signature)) return false;

  const handleSellerLike = SELLER_HANDLE_RE.test(authorId || '');
  const personal = signature ? PERSONAL_BIO_RE.test(signature) : false;
  if (personal && !handleSellerLike) return false;

  // videoCount가 명시적으로 작은 숫자면 거부. null/undefined면 통과 (IG처럼 stats 없는 플랫폼)
  if (typeof videoCount === 'number' && videoCount > 0 && videoCount < MIN_VIDEO_COUNT_FOR_SELLER) {
    return false;
  }

  // 의뢰인 ① 일관성 강화: 시그너처에 명시적 셀러 자기소개 OR 셀러 핸들 패턴 필수.
  // 단순히 bio에 링크만 있는 게 아니라, 본인이 "셀러로 운영 중"임을 자칭해야 통과.
  const strongSelfId = signature ? STRONG_SELLER_SIG_RE.test(signature) : false;
  if (!strongSelfId && !handleSellerLike) return false;

  return true;
}

export interface CreatorFetchResult {
  bioUrl?: string | null;
  signature?: string | null;
  authorName?: string | null;
  followerCount?: number | null;
  videoCount?: number | null;
}

/**
 * 캐시된 Creator를 반환하거나, 만료/없음이면 fetcher로 갱신.
 * fetcher가 null을 반환하면(API 실패) — 기존 캐시가 있으면 stale로 반환,
 * 없으면 null 반환 (호출부에서 가용성 fallback 처리).
 */
export async function getOrFetchCreator(
  platform: Platform,
  authorId: string,
  fetcher: () => Promise<CreatorFetchResult | null>,
): Promise<Creator | null> {
  if (!authorId) return null;

  const existing = await prisma.creator.findUnique({
    where: { platform_authorId: { platform, authorId } },
  });

  const fresh =
    existing && Date.now() - existing.lastCheckedAt.getTime() < CREATOR_TTL_MS;

  if (fresh) return existing;

  let info: CreatorFetchResult | null = null;
  try {
    info = await fetcher();
  } catch (err) {
    console.error(`Creator fetch failed (${platform}/${authorId}):`, err);
  }

  if (!info) {
    // 갱신 실패 — stale 캐시라도 반환
    return existing;
  }

  const sigTrimmed = (info.signature ?? '').substring(0, 500);
  const hasSalesLink = isQualifiedSeller({
    authorId,
    bioUrl: info.bioUrl,
    signature: sigTrimmed,
    videoCount: info.videoCount,
  });

  const data = {
    platform,
    authorId,
    authorName: info.authorName ?? existing?.authorName ?? null,
    bioUrl: info.bioUrl ?? null,
    signature: sigTrimmed,
    followerCount: info.followerCount ?? null,
    videoCount: info.videoCount ?? null,
    hasSalesLink,
    lastCheckedAt: new Date(),
  };

  return prisma.creator.upsert({
    where: { platform_authorId: { platform, authorId } },
    update: data,
    create: data,
  });
}
