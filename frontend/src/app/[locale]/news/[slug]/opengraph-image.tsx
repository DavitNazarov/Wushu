import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/seo/og';
import { fetchPublicJson } from '@/lib/seo/fetchPublic';
import type { PublicNewsPost } from '@/lib/api/public';

// Per-article share card.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Georgian Wushu Federation news';

export default async function NewsOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPublicJson<PublicNewsPost>(
    `/api/public/news/${slug}`,
  );

  if (!post) {
    return renderOgImage({
      eyebrow: 'Federation News',
      title: 'Georgian Wushu Federation',
    });
  }

  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : undefined;

  return renderOgImage({
    eyebrow: 'Federation News',
    title: post.title,
    subtitle: date,
  });
}
