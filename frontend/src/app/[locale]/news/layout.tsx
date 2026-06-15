import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo/metadata';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

// Metadata for the news index (client page). The /news/[slug] layout below it
// overrides this with the specific article's metadata.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    locale,
    path: '/news',
    title: t('newsTitle'),
    description: t('newsDescription'),
  });
}

export default function NewsLayout({ children }: Props) {
  return <>{children}</>;
}
