'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { apiGet } from '@/lib/api/client';
import type { EventRow, BracketRow } from '@/types/api';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

export default function CoachBracketsPage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const t = useTranslations('coach.brackets');
  const tC = useTranslations('common');

  const { data: event } = useQuery({
    queryKey: ['public', 'event', eventSlug],
    queryFn: () => apiGet<EventRow>(`/api/public/events/${eventSlug}`),
    enabled: !!eventSlug,
  });

  const { data: brackets, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'brackets', eventSlug],
    queryFn: () => apiGet<BracketRow[]>(`/api/public/brackets?eventSlug=${encodeURIComponent(eventSlug)}`),
    enabled: !!eventSlug,
  });

  const list = brackets ?? [];
  const [selectedCategory, setSelectedCategory] = useState(list[0]?.categoryCode ?? '');

  const selectedBracket = list.find((b) => b.categoryCode === selectedCategory) ?? list[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={event?.name ?? eventSlug}
        subtitle={t('title')}
        actions={
          <Link href={`/${locale}/coach/events`} className="text-[13px] text-[var(--color-text-muted)] hover:underline">
            ← {tC('back')}
          </Link>
        }
      />

      {error && (
        <InlineAlert variant="error" actions={<button onClick={() => refetch()}>{tC('retry')}</button>}>
          {tC('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-lg bg-[var(--color-surface-alt)]" />
      ) : list.length === 0 ? (
        <Card>
          <h3 className="text-[15px] font-semibold">{t('emptyTitle')}</h3>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('emptyDescription')}</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {list.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedCategory(b.categoryCode)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                  selectedCategory === b.categoryCode
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
                }`}
              >
                {b.categoryCode}
              </button>
            ))}
          </div>
          {selectedBracket && (
            <Card>
              <h3 className="text-[15px] font-semibold">{selectedBracket.categoryCode}</h3>
              <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
                {selectedBracket.fights?.length ?? 0} fights
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
