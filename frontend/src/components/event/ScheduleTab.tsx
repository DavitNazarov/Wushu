'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicSchedule, usePublicScheduleSessions } from '@/hooks/usePublicApi';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import { useCanUseLiveSocket } from '@/hooks/useAuthRole';
import { usePublicEvent } from '@/hooks/usePublicApi';
import type { ScheduleFight, PublicScheduleSession } from '@/lib/api/public';

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function liveStatusCls(status: ScheduleFight['liveStatus']): string {
  switch (status) {
    case 'RUNNING':  return 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';
    case 'UPCOMING': return 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]';
    case 'FINISHED': return 'bg-emerald-500/10 text-emerald-400';
    default:         return 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
  }
}

function SessionBlock({
  session,
  fights,
  tPublic,
  locale,
}: {
  session: PublicScheduleSession | null; // null = unassigned
  fights: ScheduleFight[];
  tPublic: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          {session ? session.name : tPublic('scheduleUnscheduled')}
        </h3>
        {session && (
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {fmt(session.startTime)} – {fmt(session.endTime)}
          </span>
        )}
        <span className="text-[12px] font-normal text-[var(--color-text-muted)]">
          ({fights.length})
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
        {fights.map((f, idx) => (
          <div
            key={f.id}
            className={`flex items-center justify-between gap-4 bg-[var(--color-surface)] px-4 py-3 ${idx < fights.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
          >
            <div className="min-w-0">
              {/* Position within session */}
              <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                {f.orderInSession != null && (
                  <span className="mr-2 text-[12px] font-normal text-[var(--color-text-muted)]">
                    #{f.orderInSession}
                  </span>
                )}
                {localizedName(f.redDisplayName, f.redDisplayNameKa, locale)} vs {localizedName(f.blueDisplayName, f.blueDisplayNameKa, locale)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                {f.bracketRoundLabel} · Fight {f.bracketFightNumber}
              </p>
            </div>

            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${liveStatusCls(f.liveStatus)}`}>
              {tPublic(`liveStatus.${f.liveStatus ?? 'PENDING'}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScheduleTab({ eventSlug }: { eventSlug: string }) {
  const locale = useLocale();
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const eventQuery = usePublicEvent(eventSlug);
  const { data: fights, isLoading: fightsLoading, error, refetch } = usePublicSchedule(eventSlug);
  const { data: sessions, isLoading: sessionsLoading } = usePublicScheduleSessions(eventSlug);
  // C1: anonymous viewers have no LIVE_RUN — the gateway would reject the
  // handshake and socket.io would retry forever. They poll instead (see
  // usePublicSchedule's refetchInterval).
  const canUseLiveSocket = useCanUseLiveSocket();

  useRealtimeQuerySync({
    scope: 'public-schedule',
    eventId: eventQuery.data?.id ?? null,
    enabled: canUseLiveSocket && !!eventSlug && !!eventQuery.data?.id,
    queryKeys: [['public', 'schedule', eventSlug], ['public', 'schedule-sessions', eventSlug]],
  });

  const isLoading = fightsLoading || sessionsLoading;

  // Sort sessions by order; group fights into sessions or unassigned
  const { sessionGroups, unassigned } = useMemo(() => {
    const sortedSessions = [...(sessions ?? [])].sort((a, b) => a.order - b.order);
    const sessionGroups: Array<{ session: PublicScheduleSession; fights: ScheduleFight[] }> = sortedSessions.map((s) => ({ session: s, fights: [] }));
    const unassigned: ScheduleFight[] = [];

    for (const fight of fights ?? []) {
      if (!fight.isPlayable) continue;
      if (fight.sessionId && fight.orderInSession != null) {
        const group = sessionGroups.find((g) => g.session.id === fight.sessionId);
        if (group) {
          group.fights.push(fight);
        } else {
          unassigned.push(fight);
        }
      } else {
        unassigned.push(fight);
      }
    }

    // Sort within each session by orderInSession
    for (const group of sessionGroups) {
      group.fights.sort((a, b) => (a.orderInSession ?? 0) - (b.orderInSession ?? 0));
    }

    return { sessionGroups, unassigned };
  }, [fights, sessions]);

  const hasAnyFights = sessionGroups.some((g) => g.fights.length > 0) || unassigned.length > 0;

  if (error) {
    return (
      <InlineAlert
        variant="error"
        actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tCommon('retry')}</button>}
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

  if (!hasAnyFights) {
    return <EmptyState title={tPublic('scheduleNotPublished')} description={undefined} />;
  }

  return (
    <div className="space-y-6">
      {sessionGroups
        .filter((g) => g.fights.length > 0)
        .map(({ session, fights: sessionFights }) => (
          <SessionBlock key={session.id} session={session} fights={sessionFights} tPublic={tPublic} locale={locale} />
        ))}

      {unassigned.length > 0 && (
        <SessionBlock session={null} fights={unassigned} tPublic={tPublic} locale={locale} />
      )}
    </div>
  );
}
