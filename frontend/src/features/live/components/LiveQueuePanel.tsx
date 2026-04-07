'use client';

import { FightResultBanner } from '@/components/fight/FightResultBanner';
import { Card } from '@/components/ui/primitives/card';
import { getFightWinnerCorner } from '@/lib/live/fightPresentation';
import type { LiveQueueFightRow } from '@/types/live';

type Props = {
  fights: LiveQueueFightRow[];
  title: string;
  emptyLabel: string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export function LiveQueuePanel({ fights, title, emptyLabel, t }: Props) {
  return (
    <Card className="p-5 !shadow-none">
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
              <Card
                key={fight.id}
                className="p-4 !shadow-none bg-[var(--color-surface-alt)]/50"
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
              </Card>
            );
          })
        )}
      </div>
    </Card>
  );
}
