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
const NON_SALES_HOST_RE = /^https?:\/\/(www\.)?(instagram|facebook|fb|twitter|x|youtube|youtu|linkedin|pinterest|tumblr|threads|snapchat|t)\.(com|net|me|be)\b/i;

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

  const hasSalesLink = computeHasSalesLink(info.bioUrl, info.signature);

  const data = {
    platform,
    authorId,
    authorName: info.authorName ?? existing?.authorName ?? null,
    bioUrl: info.bioUrl ?? null,
    signature: (info.signature ?? '').substring(0, 500),
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
