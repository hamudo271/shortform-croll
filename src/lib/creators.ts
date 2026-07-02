/**
 * Creator profile cache + sales-link 추론.
 *
 * 영상 작성자의 프로필을 7일 TTL로 캐시.
 * 셀러 판정 규칙(정규식·순수 함수)은 seller-rules.ts 로 분리했다.
 * 여기서는 캐시 조회/갱신과, 갱신 시 isQualifiedSeller 로 hasSalesLink 를 산출한다.
 */

import { prisma } from '@/lib/prisma';
import type { Creator, Platform } from '@prisma/client';
import { isQualifiedSeller } from '@/lib/seller-rules';

// 규칙 함수 재노출 — 기존 import 경로(@/lib/creators) 호환 유지.
export {
  computeHasSalesLink,
  isLikelyIndianContent,
  isQualifiedSeller,
} from '@/lib/seller-rules';
export type { QualifiedSellerSignals } from '@/lib/seller-rules';

export const CREATOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
