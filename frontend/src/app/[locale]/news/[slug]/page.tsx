'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { usePublicNewsPost } from '@/hooks/usePublicApi';
import type { PublicNewsPost } from '@/lib/api/public';

type Props = { params: Promise<{ slug: string }> };

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function NewsPostPage({ params }: Props) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const { slug } = use(params);
  const { data: post, isLoading, error, refetch, isFetched } = usePublicNewsPost(slug);

  if (isFetched && !isLoading && !post) {
    notFound();
  }

  return (
    <PublicLayout>
      <div className="space-y-6 py-2">
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          ← {tCommon('back')}
        </Link>

        {error && (
          <InlineAlert
            variant="error"
            actions={
              <button onClick={() => refetch()} className="text-[13px] font-medium underline">
                {tCommon('retry')}
              </button>
            }
          >
            {tCommon('loadError')}
          </InlineAlert>
        )}

        {isLoading && (
          <div className="space-y-4">
            <Skeleton width="60%" height="28px" />
            <Skeleton width="30%" height="14px" />
            <Skeleton width="100%" height="120px" />
          </div>
        )}

        {!isLoading && post && (
          <article>
            <header className="mb-4">
              <h1 className="text-2xl font-semibold text-[var(--color-text)]">
                {post.title}
              </h1>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                {formatDate(post.publishedAt ?? post.createdAt)}
              </p>
            </header>

            <Card>
              <div className="prose prose-invert max-w-none text-[var(--color-text)]">
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--color-text)]">
                  {post.body}
                </p>
              </div>
            </Card>

            <div className="mt-6">
              {post.event ? (
                <Card className="border-[var(--color-primary)]/30">
                  <h3 className="text-[13px] font-medium text-[var(--color-text-muted)]">
                    {tPublic('relatedEvent')}
                  </h3>
                  <p className="mt-1 text-[15px] font-medium text-[var(--color-text)]">
                    {post.event.name}
                  </p>
                  {post.event.location && (
                    <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                      {post.event.location}
                    </p>
                  )}
                  <Link href={`/events/${post.event.slug}`} className="mt-3 inline-block">
                    <PrimaryButton>{tPublic('viewEvent')}</PrimaryButton>
                  </Link>
                </Card>
              ) : (
                <p className="text-[13px] text-[var(--color-text-muted)] italic">
                  {tPublic('noEventLinked')}
                </p>
              )}
            </div>
          </article>
        )}
      </div>
    </PublicLayout>
  );
}
