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

export const MIN_INTENT_SCORE = 20;

export function scorePurchaseIntent(commentTexts: string[]): number {
  if (commentTexts.length === 0) return 0;
  const matched = commentTexts.filter((t) => t && PURCHASE_INTENT_RE.test(t)).length;
  return Math.round((matched / commentTexts.length) * 100);
}
