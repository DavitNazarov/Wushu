import type { MetadataRoute } from 'next';
import { getServerApiUrl } from '@/lib/api';
import { resolveSiteUrl, SEO_LOCALES, SEO_DEFAULT_LOCALE } from '@/lib/seo/site';

type EventRow = { slug: string };
type NewsRow = { slug: string; publishedAt?: string | null };
type ClubRow = { id: string };

async function getJson<T>(apiPath: string): Promise<T[]> {
  try {
    const url = await getServerApiUrl(apiPath);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as T[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Emit one sitemap entry per locale-less path, with hreflang alternates for
// every locale so Google serves the right language version.
function entry(
  siteUrl: string,
  path: string,
  opts?: { lastModified?: string | Date; priority?: number },
): MetadataRoute.Sitemap[number] {
  const suffix = path === '/' ? '' : path;
  const languages: Record<string, string> = {};
  for (const l of SEO_LOCALES) languages[l] = `${siteUrl}/${l}${suffix}`;
  return {
    url: `${siteUrl}/${SEO_DEFAULT_LOCALE}${suffix}`,
    lastModified: opts?.lastModified,
    alternates: { languages },
    ...(opts?.priority != null ? { priority: opts.priority } : {}),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = await resolveSiteUrl();

  const [events, news, clubs] = await Promise.all([
    getJson<EventRow>('/api/public/events'),
    getJson<NewsRow>('/api/public/news'),
    getJson<ClubRow>('/api/public/clubs'),
  ]);

  const staticPaths: Array<[string, number]> = [
    ['/', 1],
    ['/events', 0.9],
    ['/news', 0.7],
    ['/clubs', 0.6],
    ['/countries', 0.4],
    ['/rules', 0.4],
    ['/about', 0.3],
    ['/contact', 0.3],
  ];

  return [
    ...staticPaths.map(([path, priority]) => entry(siteUrl, path, { priority })),
    ...events.map((e) => entry(siteUrl, `/events/${e.slug}`, { priority: 0.8 })),
    ...news.map((n) =>
      entry(siteUrl, `/news/${n.slug}`, {
        priority: 0.6,
        lastModified: n.publishedAt ?? undefined,
      }),
    ),
    ...clubs.map((c) => entry(siteUrl, `/clubs/${c.id}`, { priority: 0.5 })),
  ];
}
