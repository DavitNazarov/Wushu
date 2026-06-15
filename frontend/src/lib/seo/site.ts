import { headers } from 'next/headers';
import { i18nConfig } from '@/i18n/config';

// Public-facing brand used in <title> templates, OpenGraph site name, and
// JSON-LD organisation data. Kept here so every SEO surface stays consistent.
export const SITE_NAME = 'Georgian Wushu Federation';
export const SITE_SHORT_NAME = 'Geo Wushu';

export const SEO_LOCALES = i18nConfig.locales;
export const SEO_DEFAULT_LOCALE = i18nConfig.defaultLocale;

// OpenGraph locale tag for each app locale.
export function ogLocale(locale: string): string {
  return locale === 'ka' ? 'ka_GE' : 'en_US';
}

// Resolve the canonical absolute origin (no trailing slash). Order:
//   1. SITE_URL / NEXT_PUBLIC_SITE_URL env (set this in production).
//   2. The incoming request's Host + forwarded proto — works on the combined
//      server with zero config (mirrors lib/api.ts getServerApiUrl), so OG tags
//      and canonicals are correct in dev and on any domain without a rebuild.
//   3. localhost fallback.
// Runtime (not NEXT_PUBLIC) on purpose: read server-side per request, so the
// production compose can supply it as a normal env var.
export async function resolveSiteUrl(): Promise<string> {
  const fromEnv = (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  try {
    const h = await headers();
    const host = h.get('host');
    if (host) {
      const proto =
        h.get('x-forwarded-proto') ??
        (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable (e.g. fully static context) — fall through.
  }

  return 'http://localhost:3000';
}

// Build a locale-prefixed absolute URL. `path` is the locale-less path with a
// leading slash ('/events', '/news/foo'); '/' maps to the locale root.
export function localeUrl(siteUrl: string, locale: string, path: string): string {
  const suffix = path === '/' ? '' : path;
  return `${siteUrl}/${locale}${suffix}`;
}
