import { cookies } from 'next/headers';

export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'theme';
export const THEME_DEFAULT: Theme = 'light';

/**
 * Read theme preference from cookies on the server.
 * Returns the default ('light') if no cookie set or invalid value.
 */
export async function getThemeFromCookies(): Promise<Theme> {
  const cookieStore = await cookies();
  const value = cookieStore.get(THEME_COOKIE)?.value;
  return value === 'dark' || value === 'light' ? value : THEME_DEFAULT;
}
