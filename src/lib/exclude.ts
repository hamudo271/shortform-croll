/**
 * 비영어권/비서구 콘텐츠 제외 패턴 (앱 레벨 필터).
 *
 * DB 의 isExcluded 필드가 없으므로 응답 단계에서 제목·작성자 텍스트를
 * 검사해 거른다. /api/videos 와 /api/products 등 표시 API 전반에서 공통 사용.
 */

const EXCLUDE_PATTERNS: RegExp[] = [
  /[ऀ-ॿ]/, // Hindi (Devanagari)
  /[ঀ-৿]/, // Bengali
  /[஀-௿]/, // Tamil
  /[ఀ-౿]/, // Telugu
  /[ಀ-೿]/, // Kannada
  /[ഀ-ൿ]/, // Malayalam
  /[฀-๿]/, // Thai
  /[؀-ۿ]/, // Arabic
  /\b(india|indian|hindi|desi|pakistan|bangladesh|tamil|telugu|indonesia|thai|pinoy|filipino|vietnam)\b/i,
];

export function isExcludedContent(
  title: string,
  authorName: string | null | undefined,
): boolean {
  const text = `${title} ${authorName || ''}`;
  return EXCLUDE_PATTERNS.some((p) => p.test(text));
}
