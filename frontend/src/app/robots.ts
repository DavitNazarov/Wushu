import type { MetadataRoute } from 'next';
import { resolveSiteUrl } from '@/lib/seo/site';

// Allow crawling of the public site; keep the authenticated app, the API
// proxy, and Sentry/Next internals out of the index. Points crawlers at the
// sitemap.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = await resolveSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/sentry-tunnel',
        '/en/admin/',
        '/ka/admin/',
        '/en/coach/',
        '/ka/coach/',
        '/en/dashboard',
        '/ka/dashboard',
        '/en/login',
        '/ka/login',
        '/en/auth/',
        '/ka/auth/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
