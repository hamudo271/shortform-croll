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

/**
 * 두 임계값 — creator_link이 이미 통과한 영상은 추가로 댓글 의도만 약하게 보고
 * 통과시키고, creator 시그널이 없는 영상은 댓글이 매우 강하게 나와야 통과.
 *
 * 의뢰인 피드백: viral인데 댓글이 "wow that's weird" 류로 도배된 호기심형 영상은
 * 실제 구매로 이어지지 않으므로 거름. creator_link만으로는 부족.
 */
export const MIN_INTENT_SCORE_SOFT = 10; // creator_link + 이것 = 통과 (둘 다)
export const MIN_INTENT_SCORE_STRONG = 25; // creator_link 없으면 이 정도 강해야 단독 통과

// 하위 호환 (기존 import 안 깨지게)
export const MIN_INTENT_SCORE = MIN_INTENT_SCORE_STRONG;

export function scorePurchaseIntent(commentTexts: string[]): number {
  if (commentTexts.length === 0) return 0;
  const matched = commentTexts.filter((t) => t && PURCHASE_INTENT_RE.test(t)).length;
  return Math.round((matched / commentTexts.length) * 100);
}

/**
 * 통과 판정 — creator 통과 여부와 댓글 의도 점수를 받아서
 * passReason 반환 ('both' | 'comment_intent' | null).
 *
 * - hasSalesLink AND intent >= SOFT (10%) → 'both' (가장 좋은 케이스)
 * - !hasSalesLink AND intent >= STRONG (25%) → 'comment_intent' (bio 없지만 댓글이 매우 강함)
 * - 그 외 → null (거부)
 */
export function evaluatePass(
  hasSalesLink: boolean,
  intentScore: number,
): 'both' | 'comment_intent' | null {
  if (hasSalesLink && intentScore >= MIN_INTENT_SCORE_SOFT) return 'both';
  if (!hasSalesLink && intentScore >= MIN_INTENT_SCORE_STRONG) return 'comment_intent';
  return null;
}
