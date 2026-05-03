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

// Bio/signature 안에 보이면 "셀러로 운영 중"을 시사하는 토큰
const SIG_COMMERCE = new RegExp(
  [
    'linktr\\.ee',
    'linktree',
    'beacons',
    'stan\\.store',
    'lnk\\.bio',
    'amazon',
    'amzn\\.to',
    'shopify',
    'gumroad',
    'ko-fi',
    'kofi',
    'link in bio',
    'link below',
    'shop now',
    'shop link',
    'buy link',
    '\\bbuy\\b',
    '\\bshop\\b',
    '\\bstore\\b',
    '\\border\\b',
    'instagram\\.com',
    'instagram bio',
    '👇',
    '🔗',
    '🛒',
    // email address (협찬 문의 = 셀러 시그널)
    '[\\w.+-]+@[\\w-]+\\.[\\w.-]+',
  ].join('|'),
  'i',
);

export function computeHasSalesLink(
  bioUrl?: string | null,
  signature?: string | null,
): boolean {
  if (bioUrl && bioUrl.length > 5) return true;
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
