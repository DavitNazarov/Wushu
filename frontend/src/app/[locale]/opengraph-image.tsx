import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/seo/og';

// Default social-share card for every locale page that doesn't supply a more
// specific one (events/[slug] and news/[slug] override with per-entity cards).
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Georgian Wushu Federation';

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Georgian Wushu Federation',
    title: 'Live Wushu Results, Brackets & Schedules',
    subtitle: 'Sanda competitions across Georgia',
  });
}
