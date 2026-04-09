'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin, Swords } from 'lucide-react';
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

function statusStyle(status: ScheduleFight['liveStatus']): { chip: string; dot: string } {
  switch (status) {
    case 'RUNNING':
      return {
        chip: 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/20',
        dot: 'bg-[var(--color-primary)] animate-pulse',
      };
    case 'UPCOMING':
      return {
        chip: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/20',
        dot: 'bg-[var(--color-warning)]',
      };
    case 'FINISHED':
      return {
        chip: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        dot: 'bg-emerald-400',
      };
    default:
      return {
        chip: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] border border-[var(--color-border)]',
        dot: 'bg-[var(--color-text-muted)]',
      };
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
        <div key={label}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              {label}
            </h3>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-[12px] text-[var(--color-text-muted)]">{items.length} fights</span>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            {items.map((f, idx) => {
              const style = statusStyle(f.liveStatus);
              return (
                <div
                  key={f.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    idx < items.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                  } ${f.liveStatus === 'RUNNING' ? 'bg-[var(--color-primary)]/5' : ''}`}
                >
                  {/* Time */}
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                      {formatTime(f.scheduledAt, locale)}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
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

                  {/* Meta */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.chip}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {tPublic(`liveStatus.${f.liveStatus ?? 'PENDING'}`)}
                    </span>
                    {f.matName && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                        <MapPin className="h-2.5 w-2.5" />
                        {f.matName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
