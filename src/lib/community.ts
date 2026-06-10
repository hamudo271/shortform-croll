/**
 * 커뮤니티 레벨/정렬 로직 — 원본 server.js(추가 작업물) 규칙을 그대로 이식.
 *
 * 레벨(XP)은 저장하지 않고 활동에서 매번 계산한다:
 *   XP = 작성글×15 + 작성댓글×8 + 받은좋아요×5 + 받은댓글×3
 */

export interface LevelInfo {
  tier: string;
  xp: number;
  progress: number; // 0–100, 다음 tier 까지
  nextTier: string;
  nextXp: number;
}

const TIERS = [
  { name: 'Starter', min: 0 },
  { name: 'Builder', min: 40 },
  { name: 'Operator', min: 100 },
  { name: 'Insider', min: 180 },
] as const;

/** 한국어 tier 라벨 (UI 표기용). */
export const TIER_LABEL: Record<string, string> = {
  Starter: '스타터',
  Builder: '빌더',
  Operator: '오퍼레이터',
  Insider: '인사이더',
};

export function levelFromXp(xp: number): LevelInfo {
  const tier = [...TIERS].reverse().find((t) => xp >= t.min) || TIERS[0];
  const index = TIERS.findIndex((t) => t.name === tier.name);
  const nextTier = TIERS[index + 1] || null;
  const progress = nextTier
    ? Math.min(100, Math.round(((xp - tier.min) / (nextTier.min - tier.min)) * 100))
    : 100;
  return {
    tier: tier.name,
    xp,
    progress,
    nextTier: nextTier?.name || '',
    nextXp: nextTier?.min || tier.min,
  };
}

export interface ActivityCounts {
  posts: number;
  comments: number;
  receivedLikes: number;
  receivedComments: number;
}

export function xpFromActivity(a: ActivityCounts): number {
  return a.posts * 15 + a.comments * 8 + a.receivedLikes * 5 + a.receivedComments * 3;
}

export function levelFromActivity(a: ActivityCounts): LevelInfo & { stats: ActivityCounts } {
  return { ...levelFromXp(xpFromActivity(a)), stats: a };
}

/** 인기(hot) 점수 — 원본과 동일: 좋아요*3 + 댓글*5 + 24/경과시간(h). */
export function hotScore(input: {
  likes: number;
  commentCount: number;
  createdAt: Date | string;
}): number {
  const ageHours = Math.max(1, (Date.now() - new Date(input.createdAt).getTime()) / 36e5);
  return input.likes * 3 + input.commentCount * 5 + 24 / ageHours;
}
