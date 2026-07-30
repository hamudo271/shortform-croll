/**
 * 학습 루프 — 운영자 라벨(Video.userVerdict)을 다음 수집에 자동 반영한다.
 * 기준서: docs/COLLECTION_CRITERIA_V2.md "학습 루프"
 *
 * 라벨이 쌓이면 수집기가 이 모듈에서 규칙을 읽어간다. 사람이 config 를 고치거나
 * 재배포할 필요 없이, 라벨을 찍는 것 자체가 수집 기준을 움직인다:
 *
 *   ❌ 반복 제품/계정  → 재수집 차단 (Gemini·댓글 쿼터를 허탕에 안 씀)
 *   💰 나온 제품 유형  → 시장검증 가점 + PROVEN_DEMAND 플래그
 *   키워드별 적중률    → 잘 낚는 키워드 먼저 검색, 허탕 키워드는 벤치
 *   표본 30+          → 정식 모드의 점수 컷을 라벨 기반 값으로 자동 대체
 *
 * 반영 조건(최소 표본 수)은 전부 collect-config.ts 에 있다 — 표본이 적을 때
 * 성급하게 배우면 우연을 규칙으로 착각하기 때문에, 문턱을 채운 신호만 쓴다.
 */

import { prisma } from '@/lib/prisma';
import {
  LEARN_REJECT_PRODUCT_MIN,
  LEARN_REJECT_CREATOR_MIN,
  LEARN_KEYWORD_MIN_DECIDED,
  LEARN_SCORE_CUT_MIN_SAMPLE,
  LEARN_CACHE_TTL_MS,
  TIER_B,
} from '@/lib/collect-config';

export interface LearnedRules {
  /** 이미 ❌ 라벨이 붙은 영상 — 재판정 자체가 낭비 (Gemini/댓글 호출 절약) */
  rejectedVideoIds: Set<string>;
  /** ❌만 반복된 제품 유형 (Gemini productType 기준) */
  rejectedProductTypes: Set<string>;
  /** 💰 가 한 번이라도 나온 제품 유형 — 같은 유형의 신규 영상은 검증된 수요로 가점 */
  provenProductTypes: Set<string>;
  /** ❌만 반복된 계정 */
  rejectedCreators: Set<string>;
  /** 키워드 → 소싱감 비율(0~1). 평가 표본 3건 미만이면 항목 없음(중립) */
  keywordWinRate: Map<string, number>;
  /** 평가가 충분히 쌓였는데 💰 0건인 키워드 */
  benchedKeywords: Set<string>;
  /** 라벨 분포에서 역산한 점수 컷 (10점 척도). 표본 부족이면 null */
  learnedScoreCut: number | null;
  /** 근거가 된 라벨 총수 — 로그/화면 표기용 */
  labelCount: number;
}

export const EMPTY_RULES: LearnedRules = {
  rejectedVideoIds: new Set(),
  rejectedProductTypes: new Set(),
  provenProductTypes: new Set(),
  rejectedCreators: new Set(),
  keywordWinRate: new Map(),
  benchedKeywords: new Set(),
  learnedScoreCut: null,
  labelCount: 0,
};

// 수집 1회(최대 ~280초) 동안 라벨이 바뀔 일은 드물다 — 회차당 1쿼리로 족함
let cache: { rules: LearnedRules; at: number } | null = null;

interface Row {
  videoId: string;
  userVerdict: string | null;
  productType: string | null;
  authorName: string | null;
  sourceKeyword: string | null;
  productScore: number;
  scoreBreakdown: unknown;
}

/** 측정조건이 정상(커버리지 60+)인 점수만 컷 학습에 쓴다 — 반쪽 측정 점수는 오염원 */
function isComparable(r: Row): boolean {
  const b = r.scoreBreakdown as { measurableMax?: number } | null;
  return typeof b?.measurableMax === 'number' && b.measurableMax >= 60;
}

/**
 * 점수 컷 역산 — 1점 단위 후보 컷마다 "컷 이상 구간의 소싱감 비율"을 재서,
 * 비율 50% 이상을 유지하는 가장 낮은 컷을 고른다 (보정 분석 페이지와 같은 논리).
 */
function deriveScoreCut(rows: Row[]): number | null {
  const decided = rows.filter(
    (r) => isComparable(r) && (r.userVerdict === 'WINNER' || r.userVerdict === 'REJECT'),
  );
  if (decided.length < LEARN_SCORE_CUT_MIN_SAMPLE) return null;

  let best: number | null = null;
  for (let cut = 8; cut >= 2; cut--) {
    const above = decided.filter((r) => r.productScore >= cut);
    if (above.length < 3) continue;
    const winners = above.filter((r) => r.userVerdict === 'WINNER').length;
    if (winners / above.length >= 0.5) best = cut;
    else break; // 더 낮추면 비율이 깨진 상태 — 직전 값이 답
  }
  return best;
}

/** DB 라벨 전체 → 학습 규칙. 결과는 TTL 캐시. */
export async function loadLearnedRules(): Promise<LearnedRules> {
  if (cache && Date.now() - cache.at < LEARN_CACHE_TTL_MS) return cache.rules;

  try {
    const rows: Row[] = await prisma.video.findMany({
      where: { userVerdict: { not: null } },
      select: {
        videoId: true, userVerdict: true, productType: true, authorName: true,
        sourceKeyword: true, productScore: true, scoreBreakdown: true,
      },
      take: 5000,
    });

    const rules: LearnedRules = {
      ...EMPTY_RULES,
      rejectedVideoIds: new Set(),
      rejectedProductTypes: new Set(),
      provenProductTypes: new Set(),
      rejectedCreators: new Set(),
      keywordWinRate: new Map(),
      benchedKeywords: new Set(),
      labelCount: rows.length,
    };

    const byProduct = new Map<string, { win: number; reject: number }>();
    const byCreator = new Map<string, { win: number; reject: number }>();
    const byKeyword = new Map<string, { win: number; reject: number }>();
    const bump = (m: Map<string, { win: number; reject: number }>, k: string, verdict: string) => {
      const s = m.get(k) || { win: 0, reject: 0 };
      if (verdict === 'WINNER') s.win++;
      else if (verdict === 'REJECT') s.reject++;
      m.set(k, s);
    };

    for (const r of rows) {
      if (!r.userVerdict) continue;
      if (r.userVerdict === 'REJECT') rules.rejectedVideoIds.add(r.videoId);
      if (r.productType) bump(byProduct, r.productType, r.userVerdict);
      if (r.authorName) bump(byCreator, r.authorName, r.userVerdict);
      if (r.sourceKeyword) bump(byKeyword, r.sourceKeyword, r.userVerdict);
    }

    for (const [type, s] of byProduct) {
      if (s.win > 0) rules.provenProductTypes.add(type);
      else if (s.reject >= LEARN_REJECT_PRODUCT_MIN) rules.rejectedProductTypes.add(type);
    }
    for (const [name, s] of byCreator) {
      if (s.win === 0 && s.reject >= LEARN_REJECT_CREATOR_MIN) rules.rejectedCreators.add(name);
    }
    for (const [kw, s] of byKeyword) {
      const decided = s.win + s.reject;
      if (decided >= 3) rules.keywordWinRate.set(kw, s.win / decided);
      if (decided >= LEARN_KEYWORD_MIN_DECIDED && s.win === 0) rules.benchedKeywords.add(kw);
    }

    rules.learnedScoreCut = deriveScoreCut(rows);

    cache = { rules, at: Date.now() };
    return rules;
  } catch (err) {
    // 학습은 부가 기능 — 규칙을 못 읽어도 수집은 기본값으로 계속 돈다
    console.error('loadLearnedRules error:', err);
    return EMPTY_RULES;
  }
}

/**
 * 키워드 목록에 학습을 적용 — 적중률 높은 순으로 검색한다.
 * 예산이 중간에 끊겨도 성적 좋은 키워드는 이미 돌았게 하는 게 목적.
 * 벤치된 키워드(표본 충분 + 💰 0건)는 캘리브레이션에선 맨 뒤로(가끔은 돌아야
 * 억울한 벤치를 복권할 수 있다), 정식 모드에선 제외.
 */
export function applyKeywordLearning(
  keywords: string[],
  rules: LearnedRules,
  calibration: boolean,
): string[] {
  const rate = (kw: string) =>
    rules.benchedKeywords.has(kw) ? -1 : (rules.keywordWinRate.get(kw) ?? 0.5);
  const sorted = [...keywords].sort((a, b) => rate(b) - rate(a));
  return calibration ? sorted : sorted.filter((kw) => !rules.benchedKeywords.has(kw));
}

/** 정식 모드에서 쓸 점수 컷 — 학습값이 있으면 그것, 없으면 기준서 기본값(TIER_B). */
export function effectiveScoreCut(rules: LearnedRules): number {
  return rules.learnedScoreCut ?? TIER_B;
}
