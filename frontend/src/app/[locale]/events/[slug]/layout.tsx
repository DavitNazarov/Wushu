import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchPublicJson } from '@/lib/seo/fetchPublic';
import { JsonLd, sportsEventJsonLd } from '@/lib/seo/jsonLd';
import { resolveSiteUrl, localeUrl } from '@/lib/seo/site';
import { localizedName } from '@/lib/bilingual';
import type { PublicEvent } from '@/lib/api/public';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

// The event detail page is a client component (it streams live data via React
// Query), so its SEO lives here in a server layout that wraps it: per-event
// metadata + a SportsEvent JSON-LD block crawlers can read in the initial HTML.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  const event = await fetchPublicJson<PublicEvent>(
    `/api/public/events/${slug}`,
  );
  if (!event) {
    return buildPageMetadata({
      locale,
      path: `/events/${slug}`,
      title: t('eventsTitle'),
      description: t('eventsDescription'),
    });
  }
  const name = localizedName(event.name, event.nameKa, locale);
  const dates = [event.competitionStartDate, event.location]
    .filter(Boolean)
    .map((v, i) =>
      i === 0
        ? new Date(event.competitionStartDate).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : v,
    )
    .join(' · ');
  return buildPageMetadata({
    locale,
    path: `/events/${slug}`,
    title: name,
    description: `${name} — ${dates}. ${t('eventsDescription')}`,
    type: 'website',
  });
}

export default async function EventDetailLayout({ children, params }: Props) {
  const { locale, slug } = await params;
  const event = await fetchPublicJson<PublicEvent>(
    `/api/public/events/${slug}`,
  );

  let jsonLd: Record<string, unknown> | null = null;
  if (event) {
    const siteUrl = await resolveSiteUrl();
    jsonLd = sportsEventJsonLd({
      name: localizedName(event.name, event.nameKa, locale),
      startDate: event.competitionStartDate,
      endDate: event.competitionEndDate,
      location: event.location,
      lifecycle: event.lifecycle,
      url: localeUrl(siteUrl, locale, `/events/${slug}`),
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
