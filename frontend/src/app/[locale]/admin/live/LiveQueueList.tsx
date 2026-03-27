'use client';

import { FightResultBanner } from '@/components/fight/FightResultBanner';
import { getFightWinnerCorner } from '@/lib/live/fightPresentation';
import type { LiveQueueFightRow } from '@/types/live';

type Props = {
  fights: LiveQueueFightRow[];
  title: string;
  emptyLabel: string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function LiveQueueList({ fights, title, emptyLabel, t }: Props) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {fights.length === 0 ? (
          <p className="text-[14px] text-[var(--color-text-muted)]">{emptyLabel}</p>
        ) : (
          fights.map((fight) => {
            const winnerCorner = getFightWinnerCorner({
              winnerAthleteId: fight.winnerAthleteId,
              redAthleteId: fight.redAthleteId,
              blueAthleteId: fight.blueAthleteId,
            });
            const winnerName =
              winnerCorner === 'RED'
                ? fight.redDisplayName
                : winnerCorner === 'BLUE'
                  ? fight.blueDisplayName
                  : null;

            return (
              <div
                key={fight.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    #{fight.orderInMat ?? fight.scheduleOrder ?? fight.boutNo} · {fight.bracketRoundLabel}
                  </p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{fight.categoryName}</p>
                </div>

                <div className="mt-2 grid gap-1">
                  <p className="text-[15px] font-semibold text-[var(--color-text)]">
                    {fight.redDisplayName}
                  </p>
                  <p className="text-[14px] text-[var(--color-text-muted)]">
                    {fight.blueDisplayName}
                  </p>
                </div>

                {winnerName ? (
                  <div className="mt-3">
                    <FightResultBanner
                      title={t('fightResult')}
                      winnerName={winnerName}
                      winnerCorner={winnerCorner}
                      methodLabel={fight.winMethod ? t(`methods.${fight.winMethod}`) : null}
                      notes={fight.notes}
                      compact
                      t={t}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
