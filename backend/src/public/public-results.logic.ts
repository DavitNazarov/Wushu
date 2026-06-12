import type { CategoryPlacementRow } from '../competition/competition.logic';
import type {
  PublicClubStanding,
  PublicResultCategory,
  PublicResultPlacement,
} from './public-results.types';

type AthleteClubLookup = Map<
  string,
  {
    clubId: string | null;
    clubName: string | null;
    clubNameKa: string | null;
  }
>;

export function buildPublicPlacements(input: {
  placements: CategoryPlacementRow[];
  athleteClubById: AthleteClubLookup;
  athleteNameKaById?: Map<string, string | null>;
  isComplete: boolean;
}): PublicResultCategory['placements'] {
  const toPlacement = (
    placement: CategoryPlacementRow | null,
  ): PublicResultPlacement | null => {
    if (!placement?.athleteId || !placement.athleteName || !placement.medal) {
      return null;
    }
    if (placement.rank !== 1 && placement.rank !== 2 && placement.rank !== 3) {
      return null;
    }

    const club = input.athleteClubById.get(placement.athleteId);
    return {
      rank: placement.rank,
      athleteId: placement.athleteId,
      athleteName: placement.athleteName,
      athleteNameKa: input.athleteNameKaById?.get(placement.athleteId) ?? null,
      clubName: club?.clubName ?? null,
      clubNameKa: club?.clubNameKa ?? null,
      medal: placement.medal,
    };
  };

  // Select by MEDAL, not rank: medals are the authoritative output of
  // computeCategoryResults. In a tied round-robin pool (1-1-1 cycle) all
  // three athletes share rank 1 while medals stay distinct — rank-based
  // selection used to drop silver/bronze entirely there.
  const first = input.placements
    .filter((placement) => placement.medal === 'GOLD')
    .map((placement) => toPlacement(placement))
    .filter(
      (placement): placement is PublicResultPlacement => placement != null,
    );
  const second = input.placements
    .filter((placement) => placement.medal === 'SILVER')
    .map((placement) => toPlacement(placement))
    .filter(
      (placement): placement is PublicResultPlacement => placement != null,
    );
  const third = input.placements
    .filter((placement) => placement.medal === 'BRONZE')
    .map((placement) => toPlacement(placement))
    .filter(
      (placement): placement is PublicResultPlacement => placement != null,
    );

  return {
    isAvailable: input.isComplete && first.length === 1 && second.length === 1,
    first: first[0] ?? null,
    second: second[0] ?? null,
    third,
  };
}

export function buildPublicClubStandings(input: {
  categories: PublicResultCategory[];
  athleteClubById: AthleteClubLookup;
}): PublicClubStanding[] {
  const rows = new Map<string, PublicClubStanding>();

  const addPlacement = (
    placement: PublicResultPlacement | null,
    medal: 'gold' | 'silver' | 'bronze',
  ) => {
    if (!placement) return;

    const club = input.athleteClubById.get(placement.athleteId) ?? {
      clubId: null,
      clubName: null,
    };
    const key = `${club.clubId ?? 'none'}:${club.clubName ?? 'none'}`;
    const row = rows.get(key) ?? {
      clubId: club.clubId,
      clubName: club.clubId ? club.clubName : null,
      gold: 0,
      silver: 0,
      bronze: 0,
      total: 0,
    };

    row[medal] += 1;
    row.total += 1;
    rows.set(key, row);
  };

  for (const category of input.categories) {
    if (!category.placements.isAvailable) continue;

    addPlacement(category.placements.first, 'gold');
    addPlacement(category.placements.second, 'silver');

    for (const placement of category.placements.third) {
      addPlacement(placement, 'bronze');
    }
  }

  return [...rows.values()].sort(
    (left, right) =>
      right.gold - left.gold ||
      right.silver - left.silver ||
      right.bronze - left.bronze ||
      right.total - left.total ||
      (left.clubName ?? '\uffff').localeCompare(right.clubName ?? '\uffff'),
  );
}
