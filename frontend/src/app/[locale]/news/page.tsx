'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { usePublicNews } from '@/hooks/usePublicApi';
import type { PublicNewsItem } from '@/lib/api/public';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function NewsCardSkeleton() {
  return (
    <Card className="space-y-2">
      <Skeleton width="70%" height="18px" />
      <Skeleton width="40%" height="14px" />
      <Skeleton width="90%" height="14px" />
    </Card>
  );
}

export default function NewsPage() {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const { data: items, isLoading, error, refetch } = usePublicNews();

  return (
    <PublicLayout>
      <div className="space-y-6 py-2">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {tPublic('newsTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('newsSubtitle')}
          </p>
        </div>

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
            {[1, 2, 3].map((i) => (
              <NewsCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && !error && (!items || items.length === 0) && (
          <Card>
            <EmptyState
              title={tPublic('noNewsYet')}
              description={undefined}
            />
          </Card>
        )}

        {!isLoading && !error && items && items.length > 0 && (
          <div className="space-y-4">
            {items.map((item: PublicNewsItem) => (
              <Card
                key={item.id}
                className="transition hover:border-[var(--color-primary)]/40"
              >
                <div className="block">
                  <Link href={`/news/${item.slug}`}>
                    <h2 className="text-[15px] font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
                      {item.title}
                    </h2>
                  </Link>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {formatDate(item.publishedAt ?? item.createdAt)}
                  </p>
                  {item.event && (
                    <Link
                      href={`/events/${item.event.slug}`}
                      className="mt-2 inline-block hover:text-[var(--color-primary)]"
                    >
                      <Badge variant="default">{item.event.name}</Badge>
                    </Link>
                  )}
                  <Link
                    href={`/news/${item.slug}`}
                    className="mt-2 inline-block text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                  >
                    {tPublic('readMore')} →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
