/**
 * 댓글 수요 분석 — "어디서 사요" / "link please" 같은 구매 신호가 상위 댓글에
 * 얼마나 나오는지 점수화. 기준서 docs/COLLECTION_CRITERIA_V2.md §4-A 의 입력을 만든다.
 *
 * 영상이 광고지만 아무도 안 사는 경우("lol" 댓글뿐)와 실제로 수요가 붙은 영상을
 * 구분하는 게 목적. v2에서는 이 결과가 관문이 아니라 35점짜리 점수 항목이다
 * (관문으로 쓰면 이미 판매자가 붙은 포화 제품만 남는다).
 */

/** 구매 의도 — "사고 싶다 / 얼마냐 / 어디서 사냐" 계열. 영어권 중심 + 한국어 보조. */
const PURCHASE_INTENT_RE =
  /\b(where (can|do) i (buy|get|order|find)|where (to |can i )?(buy|get|find)|how (much|do i (buy|order|get)|to (buy|order|get))|link (in bio|please|plz)|drop the link|what'?s (the |this )?(name|brand|product)|i (just |also )?(bought|ordered|got mine|ordering|need this|want this)|need this|take my money|adding to cart|add to cart|shut up and take my money|how much|the price|cost\??|i'?m (interested|buying))\b|어디서 (사|구매|살|살수|구매할)|링크 좀|정보 좀|어디서 파|어디 사|얼마(에)?\??|구매 (어디|링크)/i;

/**
 * 구매 "확정" 표현 — 의도보다 강한 신호. 이미 돈이 오갔다는 뜻이라
 * 이 영상이 실제 매출을 만들고 있다는 직접 증거로 취급한다(+10점).
 */
const PURCHASE_CONFIRM_RE =
  /\b(just (bought|ordered|got|purchased)|i (bought|ordered|purchased) (one|it|this|mine|two)|bought (one|it|this|mine)|ordered (one|it|this|mine)|mine (just )?(arrived|came)|on its way|got mine|already ordered|copped (one|it|this))\b|나도 샀|주문했|구매했/i;

/** 링크를 직접 요구하는 질문 — 판매자가 없다는 뜻이기도 해서 선점 기회 신호. */
const LINK_QUESTION_RE =
  /\b(link\?|link please|link plz|link in bio\?|drop the link|send the link|where to buy|where can i buy|need the link|whats the link|what'?s the link)\b|링크 (좀|어디)|어디서 사요/i;

export interface CommentSignals {
  /** 구매 의도 댓글 비율 0-100 */
  intentRate: number;
  /** 구매 확정 표현이 하나라도 있는지 */
  hasPurchaseConfirmation: boolean;
  /** 링크 직접 요구 건수 */
  linkQuestions: number;
  /** 분석에 쓰인 댓글 수 */
  sampleSize: number;
}

/** 댓글 샘플에서 §4-A 점수에 필요한 신호를 한 번에 뽑는다. */
export function analyzeComments(commentTexts: string[]): CommentSignals {
  const texts = commentTexts.filter((t) => typeof t === 'string' && t.trim().length > 0);
  if (texts.length === 0) {
    return { intentRate: 0, hasPurchaseConfirmation: false, linkQuestions: 0, sampleSize: 0 };
  }
  const matched = texts.filter((t) => PURCHASE_INTENT_RE.test(t)).length;
  return {
    intentRate: Math.round((matched / texts.length) * 100),
    hasPurchaseConfirmation: texts.some((t) => PURCHASE_CONFIRM_RE.test(t)),
    linkQuestions: texts.filter((t) => LINK_QUESTION_RE.test(t)).length,
    sampleSize: texts.length,
  };
}

export function scorePurchaseIntent(commentTexts: string[]): number {
  return analyzeComments(commentTexts).intentRate;
}

/**
 * Demand Per Million — 영상의 구매 수요 추정치.
 * 댓글 샘플의 의도 비율 × 전체 댓글 수 / 조회수 × 1,000,000
 *
 * v2에서는 통과 관문이 아니라 진단 지표(상품 랭킹 정렬 등)로만 쓴다.
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
