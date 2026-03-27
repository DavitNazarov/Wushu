'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicEvent, usePublicSchedule } from '@/hooks/usePublicApi';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import type { ScheduleFight } from '@/lib/api/public';
import { groupScheduleFightsByDate } from '@/lib/public-schedule';

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function statusTone(status: ScheduleFight['liveStatus']) {
  switch (status) {
    case 'RUNNING':
      return 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]';
    case 'UPCOMING':
      return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]';
    case 'FINISHED':
      return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
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
      <div className="space-y-4">
        <Skeleton width="100%" height="80px" />
        <Skeleton width="100%" height="80px" />
      </div>
    );
  }

  if (!fights || fights.length === 0) {
    return (
      <Card>
        <EmptyState title={tPublic('scheduleNotPublished')} description={undefined} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groupedFights.map(({ label, fights: items }) => (
        <Card key={label}>
          <h3 className="mb-4 text-[15px] font-semibold text-[var(--color-text)]">{label}</h3>
          <div className="space-y-2">
            {items.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 px-3 py-2 text-[13px]"
              >
                <span className="font-medium text-[var(--color-text-muted)]">
                  #{f.scheduleOrder ?? '-'} · {formatTime(f.scheduledAt, locale)}
                </span>
                <span
                  className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(
                    f.liveStatus,
                  )}`}
                >
                  {tPublic(`liveStatus.${f.liveStatus ?? 'PENDING'}`)}
                </span>
                {f.matName && (
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {f.matName}
                  </span>
                )}
                <span className="text-[var(--color-text)]">
                  {f.redDisplayName} {tPublic('versus')} {f.blueDisplayName}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {f.bracketRoundLabel} {f.bracketFightNumber}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
