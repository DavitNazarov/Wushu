'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { StatusChip } from '@/components/ui/StatusChip';
import { apiGet } from '@/lib/api/client';
import type { EventRow, FightRow } from '@/types/api';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

export default function CoachSchedulePage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const t = useTranslations('coach.schedule');
  const tC = useTranslations('common');

  const { data: event } = useQuery({
    queryKey: ['public', 'event', eventSlug],
    queryFn: () => apiGet<EventRow>(`/api/public/events/${eventSlug}`),
    enabled: !!eventSlug,
  });

  const { data: fights, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'schedule', eventSlug],
    queryFn: () =>
      apiGet<(FightRow & { mat?: { name: string } })[]>(
        `/api/public/schedule?eventSlug=${encodeURIComponent(eventSlug)}`,
      ),
    enabled: !!eventSlug,
  });

  const list = fights ?? [];
  const byMat = list.reduce<Record<string, typeof list>>((acc, f) => {
    const mat = f.mat?.name ?? 'Unknown';
    if (!acc[mat]) acc[mat] = [];
    acc[mat].push(f);
    return acc;
  }, {});
  const mats = Object.keys(byMat).sort();

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
        <div className="space-y-6">
          {mats.map((matName) => (
            <Card key={matName}>
              <h3 className="text-[15px] font-semibold">{matName}</h3>
              <div className="mt-3 space-y-2">
                {byMat[matName]?.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded border border-[var(--color-border)] px-3 py-2 text-[13px]"
                  >
                    <span>
                      {f.redAthlete ? `${f.redAthlete.firstName} ${f.redAthlete.lastName}` : 'TBD'} vs{' '}
                      {f.blueAthlete ? `${f.blueAthlete.firstName} ${f.blueAthlete.lastName}` : 'TBD'}
                    </span>
                    <StatusChip status={f.status} label={tC(`fightStatus.${f.status}` as Parameters<typeof tC>[0])} domain="fight" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
