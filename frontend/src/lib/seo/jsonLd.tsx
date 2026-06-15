import { SITE_NAME } from './site';

// Renders a JSON-LD <script> block. Server-only (no 'use client') so it ships
// in the initial HTML where crawlers read it. dangerouslySetInnerHTML is safe
// here: the payload is JSON.stringify of structured data we build, and we strip
// the one sequence ("</") that could break out of the <script> element.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

// schema.org SportsOrganization for the federation (home page).
export function organizationJsonLd(input: {
  siteUrl: string;
  description: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: SITE_NAME,
    sport: 'Wushu',
    url: input.siteUrl,
    description: input.description,
  };
}

// schema.org SportsEvent for a competition. Drives Google's event rich results
// (date, location, status).
export function sportsEventJsonLd(input: {
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  lifecycle: string;
  url: string;
  siteUrl: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: input.name,
    sport: 'Wushu',
    startDate: input.startDate,
    endDate: input.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: input.url,
    ...(input.location
      ? {
          location: {
            '@type': 'Place',
            name: input.location,
            address: input.location,
          },
        }
      : {}),
    organizer: {
      '@type': 'SportsOrganization',
      name: SITE_NAME,
      url: input.siteUrl,
    },
  };
}

// schema.org NewsArticle for a federation news post.
export function newsArticleJsonLd(input: {
  headline: string;
  datePublished: string | null;
  url: string;
  imageUrl: string;
  siteUrl: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: input.headline,
    ...(input.datePublished
      ? { datePublished: input.datePublished, dateModified: input.datePublished }
      : {}),
    image: [input.imageUrl],
    url: input.url,
    author: { '@type': 'Organization', name: SITE_NAME, url: input.siteUrl },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: input.siteUrl },
  };
}
