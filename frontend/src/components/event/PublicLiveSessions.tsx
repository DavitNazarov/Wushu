'use client';

import { useLocale } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import { Card } from '@/components/ui/Card';
import { SESSION_WRAP_UP_THRESHOLD } from '@/lib/live/sessions';
import type { PublicScheduleSession, ScheduleFight } from '@/lib/api/public';

type Props = {
  fights: ScheduleFight[];
  sessions: PublicScheduleSession[];
  heading: string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function isFinished(fight: ScheduleFight): boolean {
  return (
    fight.liveStatus === 'FINISHED' ||
    fight.status === 'COMPLETE' ||
    fight.status === 'CONFIRMED'
  );
}

function statusDot(fight: ScheduleFight): string {
  if (fight.liveStatus === 'RUNNING') return 'bg-[var(--color-primary)]';
  if (fight.liveStatus === 'UPCOMING') return 'bg-[var(--color-warning)]';
  if (isFinished(fight)) return 'bg-[var(--color-success)]';
  return 'bg-[var(--color-border)]';
}

type Group = {
  id: string;
  name: string;
  order: number;
  fights: ScheduleFight[];
  done: number;
  total: number;
  isActive: boolean;
  isDone: boolean;
};

export function PublicLiveSessions({ fights, sessions, heading, t }: Props) {
  const locale = useLocale();

  const sessionFights = fights.filter((fight) => fight.sessionId != null);
  if (sessionFights.length === 0 || sessions.length === 0) return null;

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const byId = new Map<string, Group>();
  for (const fight of sessionFights) {
    const session = sessionById.get(fight.sessionId!);
    if (!session) continue;
    let group = byId.get(session.id);
    if (!group) {
      group = {
        id: session.id,
        name: session.name,
        order: session.order,
        fights: [],
        done: 0,
        total: 0,
        isActive: false,
        isDone: false,
      };
      byId.set(session.id, group);
    }
    group.fights.push(fight);
  }

  let groups = [...byId.values()];
  if (groups.length === 0) return null;

  // Active session = the one with a running fight, else the first unfinished.
  const byOrderAsc = [...groups].sort((a, b) => a.order - b.order);
  const activeId =
    byOrderAsc.find((g) => g.fights.some((f) => f.liveStatus === 'RUNNING'))?.id ??
    byOrderAsc.find((g) => g.fights.some((f) => !isFinished(f)))?.id ??
    null;

  for (const group of groups) {
    group.total = group.fights.length;
    group.done = group.fights.filter(isFinished).length;
    group.isDone = group.done === group.total;
    group.isActive = group.id === activeId;
    // Numeration sorted from last (newest fight first).
    group.fights.sort(
      (a, b) => (b.orderInSession ?? 0) - (a.orderInSession ?? 0),
    );
  }

  // Current session first, then completed (newest first), then upcoming.
  const rank = (g: Group) => (g.isActive ? 0 : g.isDone ? 1 : 2);
  groups = groups.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return rank(a) === 2 ? a.order - b.order : b.order - a.order;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {heading}
      </h2>
      {groups.map((group) => {
        const remaining = group.total - group.done;
        const showWrapUp =
          group.isActive && remaining > 0 && remaining <= SESSION_WRAP_UP_THRESHOLD;
        const statusLabel = group.isDone
          ? t('sessionDone')
          : group.isActive
            ? t('sessionActive')
            : t('sessionUpcoming');
        const statusClass = group.isDone
          ? 'border-[var(--color-success)]/40 bg-[var(--color-success-subtle)] text-[var(--color-success)]'
          : group.isActive
            ? 'border-[var(--color-primary)]/45 bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';

        return (
          <Card
            key={group.id}
            className={group.isActive ? 'ring-1 ring-[var(--color-primary)]/20' : ''}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
                  {group.name}
                </h3>
                <span
                  className={`rounded-[var(--radius-pill)] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </div>
              <span className="text-[12px] font-medium text-[var(--color-text-muted)] tabular-nums">
                {t('sessionProgress', { done: group.done, total: group.total })}
              </span>
            </div>

            {showWrapUp && (
              <div
                role="status"
                className="mt-3 flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--color-text)]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warning)]" />
                {t('sessionWrapUp', { count: remaining })}
              </div>
            )}

            <div className="mt-3 space-y-2">
              {group.fights.map((fight) => {
                const redClass =
                  fight.winnerCorner === 'RED'
                    ? 'font-bold text-[var(--color-danger)]'
                    : fight.winnerCorner === 'BLUE'
                      ? 'text-[var(--color-text-muted)]'
                      : 'text-[var(--color-text)]';
                const blueClass =
                  fight.winnerCorner === 'BLUE'
                    ? 'font-bold text-sky-400'
                    : fight.winnerCorner === 'RED'
                      ? 'text-[var(--color-text-muted)]'
                      : 'text-[var(--color-text)]';

                return (
                  <div
                    key={fight.id}
                    className={`flex items-center gap-3 rounded-[var(--radius-card)] border px-3 py-2.5 ${
                      fight.liveStatus === 'RUNNING'
                        ? 'border-[var(--color-primary)]/45 bg-[var(--color-primary-subtle)]'
                        : isFinished(fight)
                          ? 'border-[var(--color-border)] bg-[var(--color-surface-alt)]/40'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${statusDot(fight)}`}
                      aria-hidden
                    />
                    <span className="w-7 shrink-0 text-center text-[12px] font-semibold text-[var(--color-text-muted)] tabular-nums">
                      #{fight.orderInSession ?? fight.scheduleOrder ?? fight.bracketFightNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5 text-[14px]">
                        <span className={`truncate font-semibold ${redClass}`}>
                          {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)}
                        </span>
                        <span className="shrink-0 text-[11px] font-bold uppercase text-[var(--color-text-muted)]">
                          vs
                        </span>
                        <span className={`truncate font-semibold ${blueClass}`}>
                          {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                        {fight.bracketRoundLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
