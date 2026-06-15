import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo/metadata';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

// SEO for the static about page (its page.tsx is a client component).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    locale,
    path: '/about',
    title: t('aboutTitle'),
    description: t('aboutDescription'),
  });
}

export default function AboutLayout({ children }: Props) {
  return <>{children}</>;
}
