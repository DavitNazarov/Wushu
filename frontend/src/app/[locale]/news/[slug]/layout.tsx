import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchPublicJson } from '@/lib/seo/fetchPublic';
import { JsonLd, newsArticleJsonLd } from '@/lib/seo/jsonLd';
import { resolveSiteUrl, localeUrl } from '@/lib/seo/site';
import type { PublicNewsPost } from '@/lib/api/public';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

// Excerpt a plain-text description from the post body for the meta description
// and OG card (strip newlines, cap length).
function excerpt(body: string, max = 180): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// The news post page is a client component; its SEO (metadata + NewsArticle
// JSON-LD) lives in this server layout.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  const post = await fetchPublicJson<PublicNewsPost>(
    `/api/public/news/${slug}`,
  );
  if (!post) {
    return buildPageMetadata({
      locale,
      path: `/news/${slug}`,
      title: t('newsTitle'),
      description: t('newsDescription'),
    });
  }
  return buildPageMetadata({
    locale,
    path: `/news/${slug}`,
    title: post.title,
    description: post.body ? excerpt(post.body) : t('newsDescription'),
    type: 'article',
    publishedTime: post.publishedAt ?? post.createdAt,
  });
}

export default async function NewsPostLayout({ children, params }: Props) {
  const { locale, slug } = await params;
  const post = await fetchPublicJson<PublicNewsPost>(
    `/api/public/news/${slug}`,
  );

  let jsonLd: Record<string, unknown> | null = null;
  if (post) {
    const siteUrl = await resolveSiteUrl();
    const url = localeUrl(siteUrl, locale, `/news/${slug}`);
    jsonLd = newsArticleJsonLd({
      headline: post.title,
      datePublished: post.publishedAt ?? post.createdAt,
      url,
      imageUrl: `${url}/opengraph-image`,
      siteUrl,
    });
  }

  return (
    <>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      {children}
    </>
  );
}
