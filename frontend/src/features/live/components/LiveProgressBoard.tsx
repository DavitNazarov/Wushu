'use client';

import { useLocale } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import { getFightWinnerCorner } from '@/lib/live/fightPresentation';
import { Card } from '@/components/ui/primitives/card';
import type { LiveQueueFightRow } from '@/types/live';

type Props = {
  completed: LiveQueueFightRow[];
  upcoming: LiveQueueFightRow[];
  currentFightId: string | null;
  onDeckFightId: string | null;
  wrapUp: { sessionName: string | null; remaining: number } | null;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function fightNumber(fight: LiveQueueFightRow): number | string {
  return fight.orderInSession ?? fight.scheduleOrder ?? fight.boutNo;
}

/** Category descriptor: age group → weight. */
function categoryLine(fight: LiveQueueFightRow): string {
  return [fight.ageGroupName, fight.categoryName].filter(Boolean).join(' · ');
}

type CompletedGroup = {
  id: string | null;
  name: string | null;
  order: number;
  fights: LiveQueueFightRow[];
};

/** Group completed fights by session, most-recently-finished session first. */
function groupCompletedBySession(
  completed: LiveQueueFightRow[],
): CompletedGroup[] {
  const map = new Map<string | null, CompletedGroup>();
  for (const fight of completed) {
    let group = map.get(fight.sessionId);
    if (!group) {
      group = {
        id: fight.sessionId,
        name: fight.sessionName,
        order: fight.sessionOrder ?? -1,
        fights: [],
      };
      map.set(fight.sessionId, group);
    }
    group.fights.push(fight);
  }
  return [...map.values()].sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return b.order - a.order;
  });
}

function CompletedRow({
  fight,
  locale,
  t,
}: {
  fight: LiveQueueFightRow;
  locale: string;
  t: Props['t'];
}) {
  const winnerCorner = getFightWinnerCorner({
    winnerAthleteId: fight.winnerAthleteId,
    redAthleteId: fight.redAthleteId,
    blueAthleteId: fight.blueAthleteId,
  });
  const redClass =
    winnerCorner === 'RED'
      ? 'font-bold text-[var(--color-danger)]'
      : 'text-[var(--color-text-muted)]';
  const blueClass =
    winnerCorner === 'BLUE'
      ? 'font-bold text-sky-400'
      : 'text-[var(--color-text-muted)]';

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 px-3 py-2">
      <span className="w-7 shrink-0 text-center text-[12px] font-semibold text-[var(--color-text-muted)] tabular-nums">
        #{fightNumber(fight)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[14px]">
          <span className={`truncate ${redClass}`}>
            {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)}
          </span>
          <span className="shrink-0 text-[11px] font-bold uppercase text-[var(--color-text-muted)]">
            vs
          </span>
          <span className={`truncate ${blueClass}`}>
            {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
          </span>
        </div>
      </div>
      {fight.winMethod && (
        <span className="shrink-0 text-[11px] font-medium text-[var(--color-text-muted)]">
          {t(`methods.${fight.winMethod}`)}
        </span>
      )}
    </div>
  );
}

export function LiveProgressBoard({
  completed,
  upcoming,
  currentFightId,
  onDeckFightId,
  wrapUp,
  t,
}: Props) {
  const locale = useLocale();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ══ Completed (newest first) ══ */}
      <Card className="p-5 !shadow-none">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('completedHistory')}
        </p>

        {completed.length === 0 ? (
          <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">
            {t('noCompleted')}
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {groupCompletedBySession(completed).map((group) => (
              <div key={group.id ?? 'unassigned'}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {group.name ?? t('sessionUnassigned')}
                </p>
                <div className="space-y-1.5">
                  {group.fights.map((fight) => (
                    <CompletedRow key={fight.id} fight={fight} locale={locale} t={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ══ In progress (upcoming queue) ══ */}
      <Card className="p-5 !shadow-none">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('inProgressHeading')}
        </p>

        {wrapUp && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--color-text)]"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warning)]" />
            {t('sessionWrapUp', { count: wrapUp.remaining })}
          </div>
        )}

        {upcoming.length === 0 ? (
          <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">
            {t('noUpcoming')}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {upcoming.map((fight) => {
              const isCurrent = fight.id === currentFightId;
              const isOnDeck = fight.id === onDeckFightId;
              const ring = isCurrent
                ? 'border-[var(--color-primary)]/45 bg-[var(--color-primary-subtle)]'
                : isOnDeck
                  ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]';

              return (
                <div
                  key={fight.id}
                  className={`rounded-[var(--radius-card)] border px-3 py-2.5 ${ring}`}
                >
                  {/* number + category */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-[var(--color-text-muted)] tabular-nums">
                      #{fightNumber(fight)}
                      {isCurrent ? ` · ${t('now')}` : isOnDeck ? ` · ${t('onDeck')}` : ''}
                    </span>
                    <span className="truncate text-[11px] text-[var(--color-text-muted)]">
                      {categoryLine(fight)}
                    </span>
                  </div>

                  {/* corners */}
                  <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                    <div className="rounded-[var(--radius-card)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/8 px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-danger)]">
                        {t('red')}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--color-text)]">
                        {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)}
                      </p>
                      {fight.redClubName && (
                        <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                          {localizedName(fight.redClubName, fight.redClubNameKa, locale)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center">
                      <span className="text-[11px] font-bold uppercase text-[var(--color-text-muted)]">
                        vs
                      </span>
                    </div>

                    <div className="rounded-[var(--radius-card)] border border-sky-500/20 bg-sky-500/8 px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400">
                        {t('blue')}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--color-text)]">
                        {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
                      </p>
                      {fight.blueClubName && (
                        <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                          {localizedName(fight.blueClubName, fight.blueClubNameKa, locale)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
