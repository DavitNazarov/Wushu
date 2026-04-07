import type { CookieOptions } from 'express';

type SameSiteValue = 'strict' | 'lax' | 'none';

/**
 * Reads COOKIE_SAME_SITE from the environment and returns a validated value.
 * Defaults to 'lax' which is safe for same-origin proxy setups.
 *
 * Set to 'none' only when cookies must be sent in cross-site contexts
 * (requires NODE_ENV=production so the Secure flag is also set).
 */
function getCookieSameSite(): SameSiteValue {
  const raw = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
  if (raw === 'strict' || raw === 'none' || raw === 'lax') return raw;
  return 'lax';
}

function getCookieBaseOptions(): Pick<
  CookieOptions,
  'httpOnly' | 'sameSite' | 'secure' | 'path'
> {
  const sameSite = getCookieSameSite();
  return {
    httpOnly: true,
    sameSite,
    // Secure must be true when sameSite='none'; also always true in production.
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    path: '/',
  };
}

export function getAuthCookieOptions(maxAge: number): CookieOptions {
  return {
    ...getCookieBaseOptions(),
    maxAge,
  };
}

export function getAuthCookieClearOptions(): CookieOptions {
  return getCookieBaseOptions();
}
