'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Swords } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { ApiError, apiGet } from '@/lib/api/client';
import type { EventRow, ScheduleFightRow } from '@/types/api';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

export default function CoachSchedulePage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const t = useTranslations('coach.schedule');
  const tC = useTranslations('common');
  const tLocale = useLocale();

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
  const byMat = list.reduce<Record<string, typeof list>>((acc, f) => {
    const mat = f.matName ?? t('unassigned');
    if (!acc[mat]) acc[mat] = [];
    acc[mat].push(f);
    return acc;
  }, {});
  const mats = Object.keys(byMat).sort();

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
          {mats.map((matName) => {
            const items = byMat[matName] ?? [];
            return (
              <div key={matName}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      {matName}
                    </h3>
                  </div>
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                  <span className="text-[12px] text-[var(--color-text-muted)]">{items.length} fights</span>
                </div>

                <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  {items.map((f, idx) => (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        idx < items.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                      } ${f.liveStatus === 'RUNNING' ? 'bg-[var(--color-primary)]/5' : ''}`}
                    >
                      {/* Order */}
                      <div className="w-10 shrink-0 text-center">
                        <p className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                          #{f.scheduleOrder ?? '—'}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="h-8 w-px shrink-0 bg-[var(--color-border)]" />

                      {/* Athletes */}
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-[var(--color-text)]">
                          {f.redDisplayName}
                        </span>
                        <Swords className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />
                        <span className="truncate text-[13px] font-medium text-[var(--color-text)]">
                          {f.blueDisplayName}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        <StatusChip
                          status={f.status}
                          label={tC(`fightStatus.${f.status}` as Parameters<typeof tC>[0])}
                          domain="fight"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
