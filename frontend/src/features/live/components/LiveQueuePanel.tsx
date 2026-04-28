'use client';

import { useLocale } from 'next-intl';
import { getFightWinnerCorner } from '@/lib/live/fightPresentation';
import { localizedName } from '@/lib/bilingual';
import { Card } from '@/components/ui/primitives/card';
import type { LiveQueueFightRow } from '@/types/live';

type Props = {
  fights: LiveQueueFightRow[];
  title: string;
  emptyLabel: string;
  t: (key: string, values?: Record<string, string | number>) => string;
};

function cornerBadge(corner: 'RED' | 'BLUE' | null): string {
  if (corner === 'RED') return 'text-[var(--color-danger)]';
  if (corner === 'BLUE') return 'text-sky-400';
  return '';
}

export function LiveQueuePanel({ fights, title, emptyLabel, t }: Props) {
  const locale = useLocale();
  return (
    <Card className="p-5 !shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </p>

      {fights.length === 0 ? (
        <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">{emptyLabel}</p>
      ) : (
        <div className="mt-3 divide-y divide-[var(--color-border)]/50">
          {fights.map((fight) => {
            const winnerCorner = getFightWinnerCorner({
              winnerAthleteId: fight.winnerAthleteId,
              redAthleteId: fight.redAthleteId,
              blueAthleteId: fight.blueAthleteId,
            });
            const winnerName =
              winnerCorner === 'RED'
                ? localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)
                : winnerCorner === 'BLUE'
                  ? localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)
                  : null;

            return (
              <div key={fight.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {/* Order number */}
                <span className="w-7 shrink-0 text-center text-[12px] font-semibold text-[var(--color-text-muted)]">
                  #{fight.orderInSession ?? fight.orderInMat ?? fight.scheduleOrder ?? fight.boutNo}
                </span>

                {/* Fight info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                      {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold uppercase text-[var(--color-text-muted)]">
                      vs
                    </span>
                    <span className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                      {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                    {fight.categoryName} · {fight.bracketRoundLabel}
                  </p>
                </div>

                {/* Winner badge or empty */}
                {winnerName ? (
                  <div className="shrink-0 text-right">
                    <p className={`text-[12px] font-bold ${cornerBadge(winnerCorner)}`}>
                      {winnerName}
                    </p>
                    {fight.winMethod && (
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {t(`methods.${fight.winMethod}`)}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
