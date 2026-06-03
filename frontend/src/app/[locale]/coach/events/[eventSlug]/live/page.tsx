'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { ApiError, apiGet } from '@/lib/api/client';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';

import type { MatFeed } from './live.types';
import { MatSelector } from './components/MatSelector';
import { NowFightCard } from './components/NowFightCard';
import { OnDeckCard } from './components/OnDeckCard';
import { NextFightsList } from './components/NextFightsList';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

export default function CoachLivePage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const t = useTranslations('coach.live');
  const tC = useTranslations('common');
  const [matName, setMatName] = useState('Mat 1');

  const { data: event } = useQuery({
    queryKey: ['public', 'event', eventSlug],
    queryFn: () => apiGet<EventRow>(`/api/public/events/${eventSlug}`),
    enabled: !!eventSlug,
  });

  const { data: feed, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'mat', eventSlug, matName],
    queryFn: async () => {
      try {
        return await apiGet<MatFeed>(
          `/api/public/mat?eventSlug=${encodeURIComponent(eventSlug)}&mat=${encodeURIComponent(matName)}`,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled: !!eventSlug && !!matName,
    refetchInterval: 8000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={event ? localizedName(event.name, event.nameKa, locale) : eventSlug}
        subtitle={`${t('title')} — ${matName}`}
        actions={
          <div className="flex gap-2">
            <Link href={`/${locale}/coach/events`} className="text-[13px] text-[var(--color-text-muted)] hover:underline">
              ← {tC('back')}
            </Link>
            <SecondaryButton onClick={() => refetch()}>{t('refresh')}</SecondaryButton>
          </div>
        }
      />

      {error && (
        <InlineAlert variant="error" actions={<button onClick={() => refetch()}>{tC('retry')}</button>}>
          {tC('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-[var(--color-surface-alt)]" />
      ) : !feed ? (
        <Card>
          <p className="text-[15px] text-[var(--color-text-muted)]">{t('emptyDescription')}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <MatSelector value={matName} onChange={setMatName} />
          <NowFightCard fight={feed.now} locale={locale} />
          <OnDeckCard fight={feed.onDeck} locale={locale} />
          <NextFightsList fights={feed.next ?? []} locale={locale} />
        </div>
      )}
    </div>
  );
}
