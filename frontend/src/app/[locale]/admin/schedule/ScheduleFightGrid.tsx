'use client';

import { useLocale } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import type { ScheduleFightRow, ScheduleSessionRow } from '@/types/api';

function statusTone(status: ScheduleFightRow['liveStatus']) {
  switch (status) {
    case 'RUNNING':
      return 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]';
    case 'FINISHED':
      return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
    case 'UPCOMING':
      return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]';
    default:
      return 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]';
  }
}

function formatSessionTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function FightCard({
  fight,
  fightReadyLabel,
  fightWaitingLabel,
}: {
  fight: ScheduleFightRow;
  fightReadyLabel: string;
  fightWaitingLabel: string;
}) {
  const locale = useLocale();
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-[var(--color-text-muted)]">
          #{fight.orderInMat ?? fight.scheduleOrder ?? '-'}
        </div>
        <span
          className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(
            fight.liveStatus,
          )}`}
        >
          {(fight.liveStatus ?? 'PENDING').toLowerCase()}
        </span>
      </div>

      <div className="mt-2 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {fight.bracketRoundLabel} • {fight.bracketFightNumber}
      </div>

      <div className="mt-2 text-[13px] font-medium text-red-400">{localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)}</div>
      <div className="text-[13px] font-medium text-blue-400">{localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}</div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
        <span>{fight.isPlayable ? fightReadyLabel : fightWaitingLabel}</span>
        {fight.matName && <span>• {fight.matName}</span>}
        {fight.scheduledAt && (
          <span>
            •{' '}
            {new Date(fight.scheduledAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
}

type Props = {
  fights: ScheduleFightRow[];
  sessions: ScheduleSessionRow[];
  fightReadyLabel: string;
  fightWaitingLabel: string;
};

export function ScheduleFightGrid({
  fights,
  sessions,
  fightReadyLabel,
  fightWaitingLabel,
}: Props) {
  // If no sessions defined, render flat grid
  if (sessions.length === 0) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fights.map((fight) => (
          <FightCard
            key={fight.id}
            fight={fight}
            fightReadyLabel={fightReadyLabel}
            fightWaitingLabel={fightWaitingLabel}
          />
        ))}
      </div>
    );
  }

  // Group fights by sessionId, collect unassigned separately
  const sessionMap = new Map<string, ScheduleFightRow[]>();
  const unassigned: ScheduleFightRow[] = [];

  for (const session of sessions) {
    sessionMap.set(session.id, []);
  }

  for (const fight of fights) {
    if (fight.sessionId && sessionMap.has(fight.sessionId)) {
      sessionMap.get(fight.sessionId)!.push(fight);
    } else {
      unassigned.push(fight);
    }
  }

  return (
    <div className="space-y-8">
      {sessions.map((session) => {
        const sessionFights = sessionMap.get(session.id) ?? [];
        return (
          <div key={session.id}>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--color-text)]">
                  {session.name}
                </span>
                <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                  {formatSessionTime(session.startTime)} – {formatSessionTime(session.endTime)}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {sessionFights.length} fights
                </span>
              </div>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            {sessionFights.length === 0 ? (
              <p className="text-center text-[12px] text-[var(--color-text-muted)]">
                No fights assigned to this session yet.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sessionFights.map((fight) => (
                  <FightCard
                    key={fight.id}
                    fight={fight}
                    fightReadyLabel={fightReadyLabel}
                    fightWaitingLabel={fightWaitingLabel}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-[13px] text-[var(--color-text-muted)]">
              Unassigned ({unassigned.length})
            </span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unassigned.map((fight) => (
              <FightCard
                key={fight.id}
                fight={fight}
                fightReadyLabel={fightReadyLabel}
                fightWaitingLabel={fightWaitingLabel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
