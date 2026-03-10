type FightRow = {
  id: string;
  categoryCode: string;
  round: number;
  boutNo: number;
  winnerAthleteId: string | null;
  redAthleteId: string | null;
  blueAthleteId: string | null;
};

type PlacementRow = {
  categoryCode: string;
  goldAthleteId: string | null;
  silverAthleteId: string | null;
  bronzeAthleteIds: string[];
};

export function buildPlacementsFromConfirmedFights(
  fights: FightRow[],
  bronzePolicy: 'TWO_BRONZES' = 'TWO_BRONZES',
): PlacementRow[] {
  const byCategory = new Map<string, FightRow[]>();
  for (const fight of fights) {
    if (!byCategory.has(fight.categoryCode)) byCategory.set(fight.categoryCode, []);
    byCategory.get(fight.categoryCode)!.push(fight);
  }

  const placements: PlacementRow[] = [];
  for (const [categoryCode, categoryFights] of byCategory.entries()) {
    const ordered = [...categoryFights].sort(
      (a, b) => a.round - b.round || a.boutNo - b.boutNo,
    );
    const maxRound = ordered.reduce((max, row) => Math.max(max, row.round), 0);
    const finalFight = ordered.find((row) => row.round === maxRound);
    if (!finalFight) continue;

    const goldAthleteId = finalFight.winnerAthleteId;
    const silverAthleteId =
      goldAthleteId && goldAthleteId === finalFight.redAthleteId
        ? finalFight.blueAthleteId
        : finalFight.redAthleteId;

    const bronzeAthleteIds: string[] = [];
    if (bronzePolicy === 'TWO_BRONZES' && maxRound > 1) {
      const semis = ordered.filter((row) => row.round === maxRound - 1);
      for (const semi of semis) {
        const loserId =
          semi.winnerAthleteId && semi.winnerAthleteId === semi.redAthleteId
            ? semi.blueAthleteId
            : semi.redAthleteId;
        if (loserId) bronzeAthleteIds.push(loserId);
      }
    }

    placements.push({
      categoryCode,
      goldAthleteId: goldAthleteId ?? null,
      silverAthleteId: silverAthleteId ?? null,
      bronzeAthleteIds: [...new Set(bronzeAthleteIds)],
    });
  }

  return placements.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode));
}

export function buildMedalTable(input: {
  placements: PlacementRow[];
  athleteClubById: Map<string, { clubId: string | null; clubName: string }>;
}) {
  const medalMap = new Map<
    string,
    { clubId: string | null; clubName: string; gold: number; silver: number; bronze: number; total: number }
  >();

  const add = (athleteId: string | null, medal: 'gold' | 'silver' | 'bronze') => {
    if (!athleteId) return;
    const club = input.athleteClubById.get(athleteId) ?? {
      clubId: null,
      clubName: 'Unknown club',
    };
    const key = `${club.clubId ?? 'none'}:${club.clubName}`;
    const row = medalMap.get(key) ?? {
      clubId: club.clubId,
      clubName: club.clubName,
      gold: 0,
      silver: 0,
      bronze: 0,
      total: 0,
    };
    row[medal] += 1;
    row.total += 1;
    medalMap.set(key, row);
  };

  for (const placement of input.placements) {
    add(placement.goldAthleteId, 'gold');
    add(placement.silverAthleteId, 'silver');
    for (const athleteId of placement.bronzeAthleteIds) {
      add(athleteId, 'bronze');
    }
  }

  return [...medalMap.values()].sort(
    (a, b) =>
      b.gold - a.gold ||
      b.silver - a.silver ||
      b.bronze - a.bronze ||
      a.clubName.localeCompare(b.clubName),
  );
}
