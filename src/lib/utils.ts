/**
 * Format large numbers (e.g., 1234567 -> "1.2M")
 */
export function formatCount(count: number | bigint): string {
  const num = typeof count === 'bigint' ? Number(count) : count;

  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Calculate viral score based on view count history
 * Returns percentage growth rate
 */
export function calculateViralScore(
  viewCountHistory: Array<{ date: string; count: number }>
): number {
  if (viewCountHistory.length < 2) return 0;

  const sorted = [...viewCountHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const oldest = sorted[0].count;
  const newest = sorted[sorted.length - 1].count;

  if (oldest === 0) return newest > 0 ? 100 : 0;

  const growthRate = ((newest - oldest) / oldest) * 100;
  return Math.round(growthRate * 10) / 10;
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return `${Math.floor(diffDays / 30)}개월 전`;
}

/**
 * Platform display names
 */
export const PLATFORM_NAMES = {
  YOUTUBE: '유튜브 쇼츠',
  TIKTOK: '틱톡',
  INSTAGRAM: '인스타그램 릴스',
} as const;

/**
 * Category display names (Korean)
 */
export const CATEGORY_NAMES = {
  BEAUTY: '뷰티/화장품',
  FOOD: '식품/음료',
  FASHION: '패션/의류',
  ELECTRONICS: '전자기기',
  LIFESTYLE: '라이프스타일',
  HEALTH: '건강/피트니스',
  KIDS: '키즈/육아',
  OTHER: '기타',
} as const;

/**
 * Target age display names (Korean)
 */
export const TARGET_AGE_OPTIONS = [
  { value: '10s', label: '10대' },
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50s+', label: '50대 이상' },
] as const;

/**
 * Rough estimate of revenue a viral product video could drive.
 *
 * Heuristic:
 *   conversion = 1% of viewers click the product link
 *   buy_rate  = 5% of clickers buy
 *   avg_price = 30,000 KRW (Korean small-ticket items)
 *   engagement_boost = (likes/views) * 100, capped at 2x — proxy for trust
 *   platform_multiplier:
 *     - INSTAGRAM ×1.2  (high purchase intent in Korea reels)
 *     - TIKTOK    ×1.0
 *     - YOUTUBE   ×0.7  (more passive watching)
 *
 * This is intentionally rough — the user explicitly accepted "incorrect is OK".
 */
export function estimateRevenue(
  viewCount: number | bigint,
  likeCount: number | bigint,
  platform: string
): number {
  const views = typeof viewCount === 'bigint' ? Number(viewCount) : viewCount;
  const likes = typeof likeCount === 'bigint' ? Number(likeCount) : likeCount;

  const platformMultiplier = platform === 'INSTAGRAM' ? 1.2 : platform === 'TIKTOK' ? 1.0 : 0.7;
  const baseRevenue = views * 0.01 * 0.05 * 30_000;
  const engagement = views > 0 ? Math.min(2, (likes / views) * 100) : 1;
  const boosted = baseRevenue * Math.max(0.5, engagement) * platformMultiplier;
  return Math.round(boosted);
}

/**
 * Format KRW amount with Korean unit suffixes (억/만/원).
 */
export function formatKRW(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = amount / 100_000_000;
    return `${eok.toFixed(eok >= 10 ? 0 : 1).replace(/\.0$/, '')}억원`;
  }
  if (amount >= 10_000) {
    const man = amount / 10_000;
    return `${man.toFixed(0)}만원`;
  }
  return `${amount.toLocaleString('ko-KR')}원`;
}

/**
 * 1688 (Chinese wholesale) search URL for a product title.
 * The Korean title gets URL-encoded; 1688 will partially translate via its
 * cross-border search. Not perfect — user said best-effort is fine.
 */
export function getWholesalerSearchUrl(productTitle: string): string {
  const q = productTitle.replace(/#\S+/g, '').trim().slice(0, 80);
  return `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(q)}`;
}

/**
 * Naver Shopping search URL — where the actual seller likely lists it.
 */
export function getNaverShoppingSearchUrl(productTitle: string): string {
  const q = productTitle.replace(/#\S+/g, '').trim().slice(0, 80);
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`;
}

/**
 * Third-party video downloader URL pre-filled with the platform video URL.
 * Each platform has a different best-fit downloader.
 */
export function getDownloaderUrl(videoUrl: string, platform: string): string {
  const encoded = encodeURIComponent(videoUrl);
  if (platform === 'TIKTOK') return `https://ssstik.io/en?url=${encoded}`;
  if (platform === 'INSTAGRAM') return `https://snapinsta.app/?url=${encoded}`;
  if (platform === 'YOUTUBE') return `https://en1.savefrom.net/19/?url=${encoded}`;
  return videoUrl;
}
