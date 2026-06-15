import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/seo/og';
import { fetchPublicJson } from '@/lib/seo/fetchPublic';
import type { PublicEvent } from '@/lib/api/public';

// Per-event share card. Uses the English event name (next/og has no Georgian
// font — see lib/seo/og.tsx) plus the competition dates + location.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Wushu competition';

export default async function EventOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await fetchPublicJson<PublicEvent>(
    `/api/public/events/${slug}`,
  );

  if (!event) {
    return renderOgImage({
      eyebrow: 'Wushu Competition',
      title: 'Georgian Wushu Federation',
    });
  }

  const start = new Date(event.competitionStartDate).toLocaleDateString('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subtitle = [start, event.location].filter(Boolean).join('  ·  ');

  return renderOgImage({
    eyebrow: 'Wushu Competition',
    title: event.name,
    subtitle,
  });
}
