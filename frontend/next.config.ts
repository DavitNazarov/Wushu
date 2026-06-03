import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiUrl = (process.env.API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

const isProd = process.env.NODE_ENV === 'production';

// SEC-3: Helmet only protects the Nest `/api` responses; the Next-rendered HTML
// pages (the entire UI) previously shipped with NO security headers, leaving
// them clickjackable and without HSTS. These headers cover the web app itself.
//
// NOTE: the CSP here only sets `frame-ancestors` (anti-clickjacking) — it does
// NOT restrict script-src, because a strict script CSP for Next 16 needs
// per-request nonces wired through the inline hydration/theme scripts and must
// be verified in a running app. That stricter policy is a tracked follow-up;
// the headers below are safe to ship as-is.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: 'gnwf',
  project: 'javascript-nextjs',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: '/sentry-tunnel',
  silent: !process.env.CI,
});
