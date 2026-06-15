import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';
import { getMessages, getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { JsonLd, organizationJsonLd } from '@/lib/seo/jsonLd';
import { resolveSiteUrl } from '@/lib/seo/site';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

// Locale-wide default — also serves as the home page's metadata (the home
// page itself is a client component and can't export metadata). Deeper public
// pages override title/description/canonical with their own generateMetadata.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    locale,
    path: '/',
    title: t('homeTitle'),
    absoluteTitle: t('homeTitle'),
    description: t('homeDescription'),
  });
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const [messages, t, siteUrl] = await Promise.all([
    getMessages(),
    getTranslations({ locale, namespace: 'seo' }),
    resolveSiteUrl(),
  ]);

  // Site-wide publisher identity for search engines.
  const orgJsonLd = organizationJsonLd({
    siteUrl,
    description: t('defaultDescription'),
  });

  return (
    <NextIntlClientProvider messages={messages}>
      <JsonLd data={orgJsonLd} />
      {children}
    </NextIntlClientProvider>
  );
}
