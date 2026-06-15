import type { Metadata } from 'next';
import {
  SITE_NAME,
  SEO_LOCALES,
  SEO_DEFAULT_LOCALE,
  ogLocale,
  resolveSiteUrl,
  localeUrl,
} from './site';

type BuildPageMetadataInput = {
  locale: string;
  /** Locale-less path with a leading slash, e.g. '/events' or '/news/foo'. */
  path: string;
  /** Bare page title; the root template appends "| Georgian Wushu Federation". */
  title: string;
  description: string;
  /** Override the OG/Twitter title (defaults to "<title> | <SITE_NAME>"). */
  ogTitle?: string;
  /** Use this exact string as the document <title> (bypasses the template). */
  absoluteTitle?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string | null;
  /** Set false to keep a page out of search indexes. */
  index?: boolean;
};

// Single source of truth for a public page's metadata: canonical URL, EN/KA
// hreflang alternates, OpenGraph, and Twitter cards. Pages call this from their
// generateMetadata so the boilerplate stays in one place and consistent.
//
// OG/Twitter images are intentionally NOT set here — the per-route
// opengraph-image.tsx files (Next file convention) are merged in automatically
// and become absolute via metadataBase (set in the root layout).
export async function buildPageMetadata(
  input: BuildPageMetadataInput,
): Promise<Metadata> {
  const siteUrl = await resolveSiteUrl();
  const canonical = localeUrl(siteUrl, input.locale, input.path);

  const languages: Record<string, string> = {};
  for (const l of SEO_LOCALES) {
    languages[l] = localeUrl(siteUrl, l, input.path);
  }
  languages['x-default'] = localeUrl(siteUrl, SEO_DEFAULT_LOCALE, input.path);

  const ogTitle = input.ogTitle ?? `${input.title} | ${SITE_NAME}`;

  return {
    title: input.absoluteTitle ? { absolute: input.absoluteTitle } : input.title,
    description: input.description,
    alternates: { canonical, languages },
    ...(input.index === false
      ? { robots: { index: false, follow: false } }
      : {}),
    openGraph: {
      type: input.type ?? 'website',
      siteName: SITE_NAME,
      locale: ogLocale(input.locale),
      url: canonical,
      title: ogTitle,
      description: input.description,
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: input.description,
    },
  };
}
