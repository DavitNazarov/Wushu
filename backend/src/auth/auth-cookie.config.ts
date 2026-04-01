import type { CookieOptions } from 'express';

const PROXY_MODE_COOKIE_SAME_SITE = 'lax' as const;

function getCookieSameSite(): typeof PROXY_MODE_COOKIE_SAME_SITE {
  return process.env.COOKIE_SAME_SITE?.trim().toLowerCase() ===
    PROXY_MODE_COOKIE_SAME_SITE
    ? PROXY_MODE_COOKIE_SAME_SITE
    : PROXY_MODE_COOKIE_SAME_SITE;
}

function getCookieBaseOptions(): Pick<
  CookieOptions,
  'httpOnly' | 'sameSite' | 'secure' | 'path'
> {
  return {
    httpOnly: true,
    // Proxy mode keeps auth cookies on the frontend origin, so cross-site
    // cookie settings must stay disabled unless the architecture changes later.
    sameSite: getCookieSameSite(),
    secure: process.env.NODE_ENV === 'production',
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
