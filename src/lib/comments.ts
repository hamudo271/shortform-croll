/**
 * 댓글 구매 의도 분석 — "정보 남겨달라" / "어디서 사요" / "link please" 같은
 * 명확한 purchase intent 표현이 상위 댓글에서 얼마나 자주 나오는지 점수화.
 *
 * 영상이 광고지만 사람들이 안 사는 경우 (예: lint roller에 "lol" 댓글뿐)와
 * 실제 셀링 영상 (Daily Sunbeam에 "how much / where to buy" 댓글)을 구분하기 위함.
 */

// 영어 + 한국어 양쪽
const PURCHASE_INTENT_RE =
  /\b(where (can|do) i (buy|get|order|find)|where (to |can i )?(buy|get|find)|how (much|do i (buy|order|get)|to (buy|order|get))|link (in bio|please|plz)|drop the link|what'?s (the |this )?(name|brand|product)|i (just |also )?(bought|ordered|got mine|ordering|need this|want this)|take my money|how much|the price|cost\??|i'?m (interested|buying))\b|어디서 (사|구매|살|살수|구매할)|링크 좀|정보 좀|어디서 파|어디 사|얼마(에)?\??|구매 (어디|링크)/i;

// 댓글 의도 비율 (top-N 샘플 중 % 매칭)
export const MIN_INTENT_SCORE_STRONG = 30; // 단독 통과 임계값 (의도 비율만으로 강함)
// 하위 호환
export const MIN_INTENT_SCORE = MIN_INTENT_SCORE_STRONG;

// DPM (Demand Per Million views) — Phase 2 신규 메트릭
// intent_rate × commentCount / viewCount × 1e6
//
// 의미: "이 영상에 수요-시그널 댓글이 100만 뷰당 몇 개 달렸는가"
// - Daily Sunbeam (의뢰인 골든): DPM 153
// - 혈압계 (의뢰인 부적합): DPM 16.7
// 5배 차이로 깨끗하게 분리됨.
export const MIN_DPM_PAIRED = 17; // intent_rate 보통일 때 DPM이 이 정도 있어야
export const MIN_DPM_STRONG = 30; // intent_rate 약해도 DPM 매우 높으면 단독 통과

export function scorePurchaseIntent(commentTexts: string[]): number {
  if (commentTexts.length === 0) return 0;
  const matched = commentTexts.filter((t) => t && PURCHASE_INTENT_RE.test(t)).length;
  return Math.round((matched / commentTexts.length) * 100);
}

/**
 * Demand Per Million — 영상의 진짜 구매 수요 추정치.
 * 댓글 샘플의 의도 비율 × 전체 댓글 수 / 조회수 × 1,000,000
 *
 * 0이면 댓글 수나 조회수 데이터 부재.
 */
export function computeDemandPerMillion(
  intentRate: number,
  totalComments: number,
  viewCount: number,
): number {
  if (viewCount <= 0 || totalComments <= 0) return 0;
  const estimatedIntent = totalComments * (intentRate / 100);
  return Math.round((estimatedIntent / viewCount) * 1_000_000 * 10) / 10; // 소수 1자리
}

/**
 * 최종 통과 판정 — Phase 1(creator_link) + Phase 2(DPM + intent_rate) 종합.
 *
 * PASS 조건:
 *   (a) 강한 단독 의도: intent_rate ≥ 30%
 *   (b) 강한 단독 DPM: DPM ≥ 30
 *   (c) 둘 다 보통: hasSalesLink AND intent_rate ≥ 10% AND DPM ≥ 17
 *
 * 의뢰인 케이스 테스트:
 *   - Daily Sunbeam (55%, DPM 153): (a) ✓ → 'both'
 *   - 혈압계 (12%, DPM 16.7): 어디도 만족 못함 → null (거부) ✓
 *   - CozyPrime (10%, DPM 97): (b) ✓
 *   - Amanda (10%, DPM 6.7) — hasSalesLink Y: (c) DPM<17 → null. 단점이지만 우선 보수적으로
 */
export function evaluatePass(
  hasSalesLink: boolean,
  intentRate: number,
  totalComments: number,
  viewCount: number,
): { passReason: 'both' | 'comment_intent' | null; dpm: number } {
  const dpm = computeDemandPerMillion(intentRate, totalComments, viewCount);

  // (a) intent_rate 단독으로 강한 케이스
  if (intentRate >= MIN_INTENT_SCORE_STRONG) {
    return { passReason: hasSalesLink ? 'both' : 'comment_intent', dpm };
  }
  // (b) DPM 단독으로 강한 케이스
  if (dpm >= MIN_DPM_STRONG) {
    return { passReason: hasSalesLink ? 'both' : 'comment_intent', dpm };
  }
  // (c) 둘 다 보통 — creator_link 필수
  if (hasSalesLink && intentRate >= 10 && dpm >= MIN_DPM_PAIRED) {
    return { passReason: 'both', dpm };
  }
  return { passReason: null, dpm };
}
