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
  YOUTUBE: 'YouTube Shorts',
  TIKTOK: 'TikTok',
  INSTAGRAM: 'Instagram Reels',
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
