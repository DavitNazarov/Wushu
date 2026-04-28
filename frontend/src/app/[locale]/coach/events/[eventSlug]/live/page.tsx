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
import { localizedFullName, localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';

type AthleteSlot = { firstName: string; firstNameKa?: string | null; lastName: string; lastNameKa?: string | null };

type MatFeed = {
  mat: { id: string; name: string };
  now: { id: string; redAthlete?: AthleteSlot; blueAthlete?: AthleteSlot; status?: string } | null;
  onDeck: { id: string; redAthlete?: AthleteSlot; blueAthlete?: AthleteSlot } | null;
  next: Array<{ id: string; redAthlete?: AthleteSlot; blueAthlete?: AthleteSlot }>;
};

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
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
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
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">Mat</label>
            <input
              type="text"
              value={matName}
              onChange={(e) => setMatName(e.target.value)}
              className="mt-1 h-10 w-32 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>

          {feed.now ? (
            <Card className="border-2 border-[var(--color-primary)] bg-[var(--color-primary-subtle)]">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">{t('now')}</h3>
              <p className="mt-2 text-[18px] font-semibold">
                {feed.now.redAthlete ? localizedFullName(feed.now.redAthlete.firstName, feed.now.redAthlete.lastName, feed.now.redAthlete.firstNameKa, feed.now.redAthlete.lastNameKa, locale) : 'TBD'} vs{' '}
                {feed.now.blueAthlete ? localizedFullName(feed.now.blueAthlete.firstName, feed.now.blueAthlete.lastName, feed.now.blueAthlete.firstNameKa, feed.now.blueAthlete.lastNameKa, locale) : 'TBD'}
              </p>
            </Card>
          ) : (
            <Card>
              <h3 className="text-[12px] font-semibold uppercase text-[var(--color-text-muted)]">{t('now')}</h3>
              <p className="mt-2 text-[15px] text-[var(--color-text-muted)]">—</p>
            </Card>
          )}

          {feed.onDeck && (
            <Card>
              <h3 className="text-[12px] font-semibold uppercase text-[var(--color-text-muted)]">{t('onDeck')}</h3>
              <p className="mt-2 text-[15px]">
                {feed.onDeck.redAthlete ? localizedFullName(feed.onDeck.redAthlete.firstName, feed.onDeck.redAthlete.lastName, feed.onDeck.redAthlete.firstNameKa, feed.onDeck.redAthlete.lastNameKa, locale) : 'TBD'} vs{' '}
                {feed.onDeck.blueAthlete ? localizedFullName(feed.onDeck.blueAthlete.firstName, feed.onDeck.blueAthlete.lastName, feed.onDeck.blueAthlete.firstNameKa, feed.onDeck.blueAthlete.lastNameKa, locale) : 'TBD'}
              </p>
            </Card>
          )}

          {feed.next && feed.next.length > 0 && (
            <Card>
              <h3 className="text-[12px] font-semibold uppercase text-[var(--color-text-muted)]">{t('next')}</h3>
              <ul className="mt-2 space-y-1 text-[14px]">
                {feed.next.map((f) => (
                  <li key={f.id}>
                    {f.redAthlete ? localizedFullName(f.redAthlete.firstName, f.redAthlete.lastName, f.redAthlete.firstNameKa, f.redAthlete.lastNameKa, locale) : 'TBD'} vs{' '}
                    {f.blueAthlete ? localizedFullName(f.blueAthlete.firstName, f.blueAthlete.lastName, f.blueAthlete.firstNameKa, f.blueAthlete.lastNameKa, locale) : 'TBD'}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
