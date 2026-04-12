'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicEvent, usePublicSchedule } from '@/hooks/usePublicApi';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import type { ScheduleFight } from '@/lib/api/public';
import { groupScheduleFightsByDate } from '@/lib/public-schedule';

function liveStatusLabel(status: ScheduleFight['liveStatus'], t: ReturnType<typeof useTranslations>): string {
  return t(`liveStatus.${status ?? 'PENDING'}`);
}

function liveStatusCls(status: ScheduleFight['liveStatus']): string {
  switch (status) {
    case 'RUNNING':
      return 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';
    case 'UPCOMING':
      return 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]';
    case 'FINISHED':
      return 'bg-emerald-500/10 text-emerald-400';
    default:
      return 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
  }
}

export function ScheduleTab({ eventSlug }: { eventSlug: string }) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const eventQuery = usePublicEvent(eventSlug);
  const { data: fights, isLoading, error, refetch } = usePublicSchedule(eventSlug);
  const unscheduledLabel = tPublic('scheduleUnscheduled');

  useRealtimeQuerySync({
    scope: 'public-schedule',
    eventId: eventQuery.data?.id ?? null,
    enabled: !!eventSlug && !!eventQuery.data?.id,
    queryKeys: [['public', 'schedule', eventSlug]],
  });

  const groupedFights = useMemo(
    () =>
      groupScheduleFightsByDate({
        fights: fights ?? [],
        locale,
        unscheduledLabel,
      }),
    [fights, locale, unscheduledLabel],
  );

  if (error) {
    return (
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
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton width="100%" height="20px" />
        <Skeleton width="100%" height="160px" />
        <Skeleton width="100%" height="20px" />
        <Skeleton width="100%" height="120px" />
      </div>
    );
  }

  if (!fights || fights.length === 0) {
    return <EmptyState title={tPublic('scheduleNotPublished')} description={undefined} />;
  }

  return (
    <div className="space-y-6">
      {groupedFights.map(({ label, fights: items }) => (
        <div key={label}>
          {/* Section header — matches athlete profile section headers */}
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {label}
            <span className="ml-2 font-normal normal-case tracking-normal">({items.length})</span>
          </h3>

          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
            {items.map((f, idx) => (
              <div
                key={f.id}
                className={`flex items-center justify-between gap-4 bg-[var(--color-surface)] px-4 py-3 ${
                  idx < items.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                }`}
              >
                {/* Order + names */}
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                    {f.redDisplayName} vs {f.blueDisplayName}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                    #{f.scheduleOrder ?? '—'}
                    {f.matName ? ` · ${f.matName}` : ''}
                  </p>
                </div>

                {/* Status */}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${liveStatusCls(f.liveStatus)}`}
                >
                  {liveStatusLabel(f.liveStatus, tPublic)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
