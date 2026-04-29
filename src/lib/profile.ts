/**
 * Shared parsers/validators for user profile fields (phone, business number, etc.)
 *
 * Used by signup, account-self-edit, and admin profile-edit endpoints so all
 * three apply identical normalization + validation rules.
 */

const BUSINESS_NUMBER_DIGITS_RE = /^\d{10}$/;

/**
 * Strips spaces, hyphens, and parentheses from a phone string.
 * Returns null when input is missing/empty.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Keep digits and a leading +; toss everything else.
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  if (cleaned.length < 7 || cleaned.length > 20) {
    throw new Error('INVALID_PHONE');
  }
  return cleaned;
}

/**
 * Accepts "123-45-67890" or "1234567890" — stores as canonical "123-45-67890".
 * Returns null when input is missing/empty.
 */
export function normalizeBusinessNumber(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (!BUSINESS_NUMBER_DIGITS_RE.test(digits)) {
    throw new Error('INVALID_BUSINESS_NUMBER');
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function normalizeCompanyName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 100);
}

export function normalizeName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 50);
}

/**
 * Mask a business number for list-view exposure: "123-45-*****"
 */
export function maskBusinessNumber(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-*****`;
}
