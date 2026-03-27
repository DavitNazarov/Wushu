'use client';

import type { PublicResultPlacement } from '@/lib/api/public-results';
import { PublicAthleteNameLink } from './PublicAthleteNameLink';

type Props = {
  placements: {
    isAvailable: boolean;
    first: PublicResultPlacement | null;
    second: PublicResultPlacement | null;
    third: PublicResultPlacement[];
  };
  t: (key: string, values?: Record<string, string | number>) => string;
};

function placementTone(rank: 1 | 2 | 3): string {
  if (rank === 1) {
    return 'border-[var(--color-success)]/45 bg-[var(--color-success-subtle)]';
  }
  if (rank === 2) {
    return 'border-[var(--color-border)] bg-[var(--color-surface-alt)]';
  }
  return 'border-[var(--color-warning)]/45 bg-[var(--color-warning-subtle)]';
}

function PlacementCard({
  label,
  placement,
  emptyClubLabel,
}: {
  label: string;
  placement: PublicResultPlacement;
  emptyClubLabel: string;
}) {
  return (
    <div className={`rounded-[var(--radius-card)] border p-4 ${placementTone(placement.rank)}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <PublicAthleteNameLink
        athleteId={placement.athleteId}
        label={placement.athleteName}
        className="mt-2 block text-lg font-semibold text-[var(--color-text)]"
      />
      <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
        {placement.clubName ?? emptyClubLabel}
      </p>
    </div>
  );
}

export function PublicResultsPlacements({ placements, t }: Props) {
  if (!placements.isAvailable) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/45 px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
        {t('resultsPlacementsPending')}
      </div>
    );
  }

  const thirdPlacements = placements.third.filter((placement) => placement.rank === 3);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {t('resultsPlacements')}
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {placements.first ? (
          <PlacementCard
            label={t('resultsFirstPlace')}
            placement={placements.first}
            emptyClubLabel={t('resultsNoClub')}
          />
        ) : null}
        {placements.second ? (
          <PlacementCard
            label={t('resultsSecondPlace')}
            placement={placements.second}
            emptyClubLabel={t('resultsNoClub')}
          />
        ) : null}
        {thirdPlacements.map((placement, index) => (
          <PlacementCard
            key={`${placement.athleteId}:${index}`}
            label={
              thirdPlacements.length > 1
                ? t('resultsThirdPlaceShared')
                : t('resultsThirdPlace')
            }
            placement={placement}
            emptyClubLabel={t('resultsNoClub')}
          />
        ))}
      </div>
    </div>
  );
}
