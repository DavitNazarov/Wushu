'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError, apiGet } from '@/lib/api/client';
import type { EventRow, ScheduleFightRow } from '@/types/api';

import { groupByMat } from './schedule.utils';
import { ScheduleMatGroup } from './components/ScheduleMatGroup';

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
    queryFn: async () => {
      try {
        return await apiGet<ScheduleFightRow[]>(
          `/api/public/schedule?eventSlug=${encodeURIComponent(eventSlug)}`,
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }
    },
    enabled: !!eventSlug,
  });

  const list = fights ?? [];
  const { mats, byMat } = groupByMat(list, t('unassigned'));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/coach/events`}
          className="group mb-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
          {tC('back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          {event?.name ?? eventSlug}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('title')}</p>
      </div>

      {error && (
        <InlineAlert variant="error" actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tC('retry')}</button>}>
          {tC('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton width="100%" height="80px" />
          <Skeleton width="100%" height="80px" />
          <Skeleton width="100%" height="80px" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <h3 className="text-[15px] font-semibold">{t('emptyTitle')}</h3>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('emptyDescription')}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {mats.map((matName, matIdx) => (
            <ScheduleMatGroup
              key={matName}
              matName={matName}
              matIdx={matIdx}
              fights={byMat[matName] ?? []}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
