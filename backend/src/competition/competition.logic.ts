import type { FightStatus, WinMethod } from '@prisma/client';
import type { CompetitionFormat } from '../draw/competition-format';
import { resolveCompetitionFormat } from '../draw/competition-format';
import { roundStageLabel } from '../draw/brackets.helpers';

const COMPLETED_STATUSES = new Set<FightStatus>(['COMPLETE', 'CONFIRMED']);
const ACTIVE_STATUSES = new Set<FightStatus>(['IN_PROGRESS', 'PAUSED']);

type CompetitionValidationIssueSeverity = 'CRITICAL' | 'WARNING';

export type CompetitionValidationIssue = {
  code: string;
  severity: CompetitionValidationIssueSeverity;
};

export type CompetitionFight = {
  id: string;
  round: number;
  boutNo: number;
  status: FightStatus;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId: string | null;
  winMethod?: WinMethod | null;
  notes?: string | null;
};

export type CompetitionAthlete = {
  athleteId: string;
  athleteName: string;
};

type CompetitionFightParticipantView = {
  athleteId: string | null;
  name: string;
  kind: 'ATHLETE' | 'WINNER_PLACEHOLDER' | 'BYE' | 'TBD';
  sourceBoutNo: number | null;
};

type CompetitionFightView = {
  id: string;
  round: number;
  boutNo: number;
  stageLabel: string;
  status: FightStatus;
  winnerAthleteId: string | null;
  winMethod: WinMethod | null;
  notes: string | null;
  red: CompetitionFightParticipantView;
  blue: CompetitionFightParticipantView;
};

export type CompetitionViewModel = {
  format: CompetitionFormat;
  totalFights: number;
  completedFights: number;
  completionState: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';
  needsReview: boolean;
  issues: CompetitionValidationIssue[];
  currentFight: CompetitionFightView | null;
  queue: CompetitionFightView[];
  completed: CompetitionFightView[];
};

export type RoundRobinStandingRow = {
  rank: number;
  athleteId: string;
  athleteName: string;
  fights: number;
  wins: number;
  losses: number;
  pending: number;
  points: number;
  tieBreakWins: number;
};

export type CategoryPlacementRow = {
  rank: number;
  athleteId: string | null;
  athleteName: string | null;
  medal: 'GOLD' | 'SILVER' | 'BRONZE' | null;
};

export type CategoryResults = {
  format: CompetitionFormat;
  totalFights: number;
  completedFights: number;
  isComplete: boolean;
  placements: CategoryPlacementRow[];
  medalists: {
    gold: CategoryPlacementRow | null;
    silver: CategoryPlacementRow | null;
    bronze: CategoryPlacementRow[];
  };
  standings: RoundRobinStandingRow[] | null;
  // ROUND_ROBIN only: true when the completed pool ends in a rank tie inside
  // the medal positions (e.g. the 3-way 1-1-1 cycle, where W-L and head-to-head
  // cannot separate the athletes). Medals are then assigned deterministically
  // (standings order) but the category needs a manual federation decision.
  tieUnresolved: boolean;
};

function sortFights(fights: CompetitionFight[]): CompetitionFight[] {
  return [...fights].sort((a, b) => a.round - b.round || a.boutNo - b.boutNo);
}

function maxRound(fights: CompetitionFight[]): number {
  return fights.reduce((max, fight) => Math.max(max, fight.round), 0);
}

function openingRound(fights: CompetitionFight[]): number {
  if (fights.length === 0) return 0;
  return fights.reduce(
    (min, fight) => Math.min(min, fight.round),
    fights[0].round,
  );
}

function fightIsComplete(status: FightStatus): boolean {
  return COMPLETED_STATUSES.has(status);
}

function collectAthleteIds(input: {
  fights: CompetitionFight[];
  athletes?: CompetitionAthlete[];
}): string[] {
  const ids = new Set<string>();
  for (const athlete of input.athletes ?? []) {
    ids.add(athlete.athleteId);
  }
  for (const fight of input.fights) {
    if (fight.redAthleteId) ids.add(fight.redAthleteId);
    if (fight.blueAthleteId) ids.add(fight.blueAthleteId);
  }
  return [...ids];
}

function getFightByRoundBout(
  fights: CompetitionFight[],
  round: number,
  boutNo: number,
): CompetitionFight | null {
  return (
    fights.find((fight) => fight.round === round && fight.boutNo === boutNo) ??
    null
  );
}

function isResultStatus(status: FightStatus): boolean {
  return status === 'COMPLETE' || status === 'CONFIRMED';
}

function loserAthleteId(fight: CompetitionFight): string | null {
  if (!fight.winnerAthleteId) return null;
  if (fight.winnerAthleteId === fight.redAthleteId) {
    return fight.blueAthleteId ?? null;
  }
  if (fight.winnerAthleteId === fight.blueAthleteId) {
    return fight.redAthleteId ?? null;
  }
  return null;
}

function participantName(athleteId: string, byId: Map<string, string>): string {
  return byId.get(athleteId) ?? athleteId;
}

function isFightReadyForExecution(input: {
  fight: CompetitionFight;
  format: CompetitionFormat;
  openingRoundNo: number;
}): boolean {
  const { fight, format, openingRoundNo } = input;
  if (fightIsComplete(fight.status)) return false;
  if (
    fight.status === 'IN_PROGRESS' ||
    fight.status === 'PAUSED' ||
    fight.status === 'ON_DECK'
  ) {
    return true;
  }
  if (fight.status !== 'QUEUED') return false;

  if (format === 'ROUND_ROBIN' || format === 'DIRECT_FINAL') {
    return Boolean(fight.redAthleteId && fight.blueAthleteId);
  }

  if (fight.round === openingRoundNo) {
    return Boolean(fight.redAthleteId && fight.blueAthleteId);
  }

  return Boolean(fight.redAthleteId && fight.blueAthleteId);
}

function participantView(input: {
  side: 'red' | 'blue';
  fight: CompetitionFight;
  fights: CompetitionFight[];
  format: CompetitionFormat;
  openingRoundNo: number;
  athleteNameById: Map<string, string>;
}): CompetitionFightParticipantView {
  const athleteId =
    input.side === 'red' ? input.fight.redAthleteId : input.fight.blueAthleteId;
  if (athleteId) {
    return {
      athleteId,
      name: participantName(athleteId, input.athleteNameById),
      kind: 'ATHLETE',
      sourceBoutNo: null,
    };
  }

  if (input.format !== 'SINGLE_ELIMINATION') {
    return {
      athleteId: null,
      name: 'TBD',
      kind: 'TBD',
      sourceBoutNo: null,
    };
  }

  if (input.fight.round === input.openingRoundNo) {
    return {
      athleteId: null,
      name: 'BYE',
      kind: 'BYE',
      sourceBoutNo: null,
    };
  }

  const sourceBoutNo =
    input.side === 'red' ? input.fight.boutNo * 2 - 1 : input.fight.boutNo * 2;
  const sourceFight = getFightByRoundBout(
    input.fights,
    input.fight.round - 1,
    sourceBoutNo,
  );

  if (sourceFight?.winnerAthleteId) {
    return {
      athleteId: sourceFight.winnerAthleteId,
      name: participantName(sourceFight.winnerAthleteId, input.athleteNameById),
      kind: 'ATHLETE',
      sourceBoutNo,
    };
  }

  return {
    athleteId: null,
    name: `Winner of ${sourceBoutNo}`,
    kind: 'WINNER_PLACEHOLDER',
    sourceBoutNo,
  };
}

function toFightView(input: {
  fight: CompetitionFight;
  fights: CompetitionFight[];
  format: CompetitionFormat;
  athleteNameById: Map<string, string>;
  maxRoundNo: number;
  openingRoundNo: number;
}): CompetitionFightView {
  return {
    id: input.fight.id,
    round: input.fight.round,
    boutNo: input.fight.boutNo,
    stageLabel: roundStageLabel(
      input.fight.round,
      input.maxRoundNo,
      input.format,
    ),
    status: input.fight.status,
    winnerAthleteId: input.fight.winnerAthleteId,
    winMethod: input.fight.winMethod ?? null,
    notes: input.fight.notes ?? null,
    red: participantView({
      side: 'red',
      fight: input.fight,
      fights: input.fights,
      format: input.format,
      openingRoundNo: input.openingRoundNo,
      athleteNameById: input.athleteNameById,
    }),
    blue: participantView({
      side: 'blue',
      fight: input.fight,
      fights: input.fights,
      format: input.format,
      openingRoundNo: input.openingRoundNo,
      athleteNameById: input.athleteNameById,
    }),
  };
}

export function validateCompetitionStructure(input: {
  format: CompetitionFormat;
  fights: CompetitionFight[];
  athleteIds: string[];
}): { needsReview: boolean; issues: CompetitionValidationIssue[] } {
  const issues: CompetitionValidationIssue[] = [];
  const fights = sortFights(input.fights);

  if (!input.format) {
    issues.push({
      code: 'UNRESOLVED_COMPETITION_FORMAT',
      severity: 'CRITICAL',
    });
    return { needsReview: true, issues };
  }

  if (input.format === 'DIRECT_FINAL') {
    if (fights.length !== 1) {
      issues.push({
        code: 'INVALID_DIRECT_FINAL_STRUCTURE',
        severity: 'CRITICAL',
      });
    }
    const fight = fights[0];
    if (
      fight &&
      (!fight.redAthleteId ||
        !fight.blueAthleteId ||
        fight.redAthleteId === fight.blueAthleteId)
    ) {
      issues.push({
        code: 'DIRECT_FINAL_INVALID_PARTICIPANTS',
        severity: 'CRITICAL',
      });
    }
  }

  if (input.format === 'SINGLE_ELIMINATION') {
    if (fights.length === 0) {
      issues.push({
        code: 'MISSING_ELIMINATION_FIGHTS',
        severity: 'CRITICAL',
      });
      return { needsReview: true, issues };
    }

    const firstRound = openingRound(fights);
    const finalRound = maxRound(fights);
    const finalFightCount = fights.filter(
      (fight) => fight.round === finalRound,
    ).length;
    if (finalFightCount !== 1) {
      issues.push({
        code: 'MISSING_FINAL_FIGHT',
        severity: 'CRITICAL',
      });
    }

    const openingAppearances = new Map<string, number>();
    for (const fight of fights) {
      if (fight.round !== firstRound) continue;
      if (!fight.redAthleteId && !fight.blueAthleteId) {
        issues.push({
          code: 'INVALID_EMPTY_FIGHT',
          severity: 'CRITICAL',
        });
      }
      if (fight.redAthleteId) {
        openingAppearances.set(
          fight.redAthleteId,
          (openingAppearances.get(fight.redAthleteId) ?? 0) + 1,
        );
      }
      if (fight.blueAthleteId) {
        openingAppearances.set(
          fight.blueAthleteId,
          (openingAppearances.get(fight.blueAthleteId) ?? 0) + 1,
        );
      }
    }
    if ([...openingAppearances.values()].some((count) => count > 1)) {
      issues.push({
        code: 'DUPLICATE_OPENING_ROUND_ATHLETE',
        severity: 'CRITICAL',
      });
    }

    for (const fight of fights) {
      if (fight.round <= firstRound) continue;
      const redSource = getFightByRoundBout(
        fights,
        fight.round - 1,
        fight.boutNo * 2 - 1,
      );
      const blueSource = getFightByRoundBout(
        fights,
        fight.round - 1,
        fight.boutNo * 2,
      );
      if (!redSource || !blueSource) {
        issues.push({
          code: 'BROKEN_FIGHT_DEPENDENCY',
          severity: 'CRITICAL',
        });
      }
    }
  }

  if (input.format === 'ROUND_ROBIN') {
    const expectedPairings =
      (input.athleteIds.length * (input.athleteIds.length - 1)) / 2;
    const pairings = new Set<string>();

    for (const fight of fights) {
      if (!fight.redAthleteId || !fight.blueAthleteId) {
        issues.push({
          code: 'ROUND_ROBIN_INVALID_SLOT',
          severity: 'CRITICAL',
        });
        continue;
      }
      if (fight.redAthleteId === fight.blueAthleteId) {
        issues.push({
          code: 'ROUND_ROBIN_INVALID_SELF_PAIRING',
          severity: 'CRITICAL',
        });
        continue;
      }
      const [a, b] = [fight.redAthleteId, fight.blueAthleteId].sort();
      const key = `${a}:${b}`;
      if (pairings.has(key)) {
        issues.push({
          code: 'ROUND_ROBIN_DUPLICATE_PAIRING',
          severity: 'CRITICAL',
        });
      }
      pairings.add(key);
    }

    if (
      pairings.size !== expectedPairings ||
      fights.length !== expectedPairings
    ) {
      issues.push({
        code: 'ROUND_ROBIN_MISSING_PAIRINGS',
        severity: 'CRITICAL',
      });
    }
  }

  if (
    fights.some(
      (fight) => isResultStatus(fight.status) && !fight.winnerAthleteId,
    )
  ) {
    issues.push({
      code: 'MISSING_FIGHT_WINNER',
      severity: 'CRITICAL',
    });
  }

  return {
    needsReview: issues.some((issue) => issue.severity === 'CRITICAL'),
    issues: [
      ...new Set(issues.map((issue) => `${issue.code}:${issue.severity}`)),
    ].map((key) => {
      const [code, severity] = key.split(':');
      return {
        code,
        severity: severity as CompetitionValidationIssueSeverity,
      };
    }),
  };
}

function getNextAvailableFight(input: {
  fights: CompetitionFight[];
  format: CompetitionFormat;
}): CompetitionFight | null {
  const fights = sortFights(input.fights);

  const activeFight = fights.find((fight) => ACTIVE_STATUSES.has(fight.status));
  if (activeFight) return activeFight;

  const onDeckFight = fights.find((fight) => fight.status === 'ON_DECK');
  if (onDeckFight) return onDeckFight;

  const firstRound = openingRound(fights);
  for (const fight of fights) {
    if (
      isFightReadyForExecution({
        fight,
        format: input.format,
        openingRoundNo: firstRound,
      })
    ) {
      return fight;
    }
  }
  return null;
}

export function buildBracketOrCompetitionViewModel(input: {
  format?: CompetitionFormat;
  fights: CompetitionFight[];
  athletes?: CompetitionAthlete[];
  ruleset?: unknown;
}): CompetitionViewModel {
  const fights = sortFights(input.fights);
  const athleteIds = collectAthleteIds({
    fights,
    athletes: input.athletes,
  });

  const format =
    input.format ??
    resolveCompetitionFormat({
      athleteCount: athleteIds.length,
      ruleset: input.ruleset,
    });

  const validation = validateCompetitionStructure({
    format,
    fights,
    athleteIds,
  });

  const nextFight = getNextAvailableFight({ fights, format });
  const doneCount = fights.filter((fight) =>
    fightIsComplete(fight.status),
  ).length;
  const firstRound = openingRound(fights);
  const highestRound = maxRound(fights);

  const athleteNameById = new Map<string, string>();
  for (const athlete of input.athletes ?? []) {
    athleteNameById.set(athlete.athleteId, athlete.athleteName);
  }

  const mapFight = (fight: CompetitionFight) =>
    toFightView({
      fight,
      fights,
      format,
      athleteNameById,
      maxRoundNo: highestRound,
      openingRoundNo: firstRound,
    });

  const queue = fights
    .filter(
      (fight) => !fightIsComplete(fight.status) && fight.id !== nextFight?.id,
    )
    .map(mapFight);

  const completed = fights
    .filter((fight) => fightIsComplete(fight.status))
    .map(mapFight);

  let completionState: CompetitionViewModel['completionState'] = 'NOT_STARTED';
  if (validation.needsReview) {
    completionState = 'NEEDS_REVIEW';
  } else if (fights.length > 0 && doneCount === fights.length) {
    completionState = 'COMPLETED';
  } else if (nextFight || doneCount > 0) {
    completionState = 'IN_PROGRESS';
  }

  return {
    format,
    totalFights: fights.length,
    completedFights: doneCount,
    completionState,
    needsReview: validation.needsReview,
    issues: validation.issues,
    currentFight: nextFight ? mapFight(nextFight) : null,
    queue,
    completed,
  };
}

export function computeRoundRobinStandings(input: {
  fights: CompetitionFight[];
  athletes?: CompetitionAthlete[];
  ruleset?: unknown;
}): RoundRobinStandingRow[] {
  const rows = new Map<
    string,
    {
      athleteId: string;
      athleteName: string;
      fights: number;
      wins: number;
      losses: number;
      pending: number;
      points: number;
      tieBreakWins: number;
    }
  >();

  const nameById = new Map<string, string>();
  for (const athlete of input.athletes ?? []) {
    nameById.set(athlete.athleteId, athlete.athleteName);
  }

  const ensureRow = (athleteId: string) => {
    const existing = rows.get(athleteId);
    if (existing) return existing;
    const created = {
      athleteId,
      athleteName: participantName(athleteId, nameById),
      fights: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      points: 0,
      tieBreakWins: 0,
    };
    rows.set(athleteId, created);
    return created;
  };

  for (const fight of input.fights) {
    if (!fight.redAthleteId || !fight.blueAthleteId) continue;
    if (fight.redAthleteId === fight.blueAthleteId) continue;

    const red = ensureRow(fight.redAthleteId);
    const blue = ensureRow(fight.blueAthleteId);
    red.fights += 1;
    blue.fights += 1;

    if (!fight.winnerAthleteId) {
      red.pending += 1;
      blue.pending += 1;
      continue;
    }

    if (fight.winnerAthleteId === red.athleteId) {
      red.wins += 1;
      red.points += 1;
      red.tieBreakWins += 1;
      blue.losses += 1;
      continue;
    }

    if (fight.winnerAthleteId === blue.athleteId) {
      blue.wins += 1;
      blue.points += 1;
      blue.tieBreakWins += 1;
      red.losses += 1;
      continue;
    }

    red.pending += 1;
    blue.pending += 1;
  }

  const sorted = [...rows.values()].sort((a, b) => {
    const byPoints = b.points - a.points;
    if (byPoints !== 0) return byPoints;
    const byWins = b.wins - a.wins;
    if (byWins !== 0) return byWins;
    const byLosses = a.losses - b.losses;
    if (byLosses !== 0) return byLosses;
    return a.athleteName.localeCompare(b.athleteName);
  });

  let currentRank = 0;
  let previous: (typeof sorted)[number] | null = null;

  return sorted.map((row, index) => {
    if (
      !previous ||
      previous.points !== row.points ||
      previous.wins !== row.wins ||
      previous.losses !== row.losses
    ) {
      currentRank = index + 1;
    }
    previous = row;
    return {
      rank: currentRank,
      athleteId: row.athleteId,
      athleteName: row.athleteName,
      fights: row.fights,
      wins: row.wins,
      losses: row.losses,
      pending: row.pending,
      points: row.points,
      tieBreakWins: row.tieBreakWins,
    };
  });
}

export function computeCategoryResults(input: {
  format?: CompetitionFormat;
  fights: CompetitionFight[];
  athletes?: CompetitionAthlete[];
  bronzePolicy?: 'TWO_BRONZES';
  ruleset?: unknown;
}): CategoryResults {
  const fights = sortFights(input.fights);
  const athleteIds = collectAthleteIds({
    fights,
    athletes: input.athletes,
  });
  const format =
    input.format ??
    resolveCompetitionFormat({
      athleteCount: athleteIds.length,
      ruleset: input.ruleset,
    });

  const totalFights = fights.length;
  const completedFights = fights.filter((fight) =>
    fightIsComplete(fight.status),
  ).length;
  const isComplete = totalFights > 0 && completedFights === totalFights;

  const nameById = new Map<string, string>();
  for (const athlete of input.athletes ?? []) {
    nameById.set(athlete.athleteId, athlete.athleteName);
  }

  if (format === 'ROUND_ROBIN') {
    const standings = computeRoundRobinStandings({
      fights,
      athletes: input.athletes,
      ruleset: input.ruleset,
    });
    // Rank ties inside the medal positions (the 3-way 1-1-1 cycle is the real
    // case for 3-athlete pools) cannot be broken from fight data alone. The
    // rank-based mapping used to hand out THREE golds here — instead assign
    // medals positionally from the deterministic standings order and flag the
    // category for manual review.
    const medalRanks = standings.slice(0, 3).map((row) => row.rank);
    const tieUnresolved =
      isComplete && new Set(medalRanks).size !== medalRanks.length;
    const MEDAL_BY_POSITION = ['GOLD', 'SILVER', 'BRONZE'] as const;
    const placements: CategoryPlacementRow[] = standings.map((row, index) => ({
      rank: row.rank,
      athleteId: row.athleteId,
      athleteName: row.athleteName,
      medal: tieUnresolved
        ? (MEDAL_BY_POSITION[index] ?? null)
        : row.rank === 1
          ? 'GOLD'
          : row.rank === 2
            ? 'SILVER'
            : row.rank === 3
              ? 'BRONZE'
              : null,
    }));
    return {
      format,
      totalFights,
      completedFights,
      isComplete,
      placements,
      medalists: {
        gold: placements.find((row) => row.medal === 'GOLD') ?? null,
        silver: placements.find((row) => row.medal === 'SILVER') ?? null,
        bronze: placements.filter((row) => row.medal === 'BRONZE'),
      },
      standings,
      tieUnresolved,
    };
  }

  const highestRound = maxRound(fights);
  const finalFight =
    fights.find((fight) => fight.round === highestRound) ?? null;
  const goldAthleteId = finalFight?.winnerAthleteId ?? null;
  const silverAthleteId = finalFight ? loserAthleteId(finalFight) : null;

  const bronzeAthleteIds: string[] = [];
  if (
    format === 'SINGLE_ELIMINATION' &&
    input.bronzePolicy === 'TWO_BRONZES' &&
    highestRound > openingRound(fights)
  ) {
    const semifinalRound = highestRound - 1;
    for (const semifinal of fights.filter(
      (fight) => fight.round === semifinalRound,
    )) {
      const loser = loserAthleteId(semifinal);
      if (loser) bronzeAthleteIds.push(loser);
    }
  }

  const placements: CategoryPlacementRow[] = [];
  placements.push({
    rank: 1,
    athleteId: goldAthleteId,
    athleteName: goldAthleteId
      ? participantName(goldAthleteId, nameById)
      : null,
    medal: 'GOLD',
  });
  placements.push({
    rank: 2,
    athleteId: silverAthleteId,
    athleteName: silverAthleteId
      ? participantName(silverAthleteId, nameById)
      : null,
    medal: 'SILVER',
  });
  for (const bronzeAthleteId of [...new Set(bronzeAthleteIds)]) {
    placements.push({
      rank: 3,
      athleteId: bronzeAthleteId,
      athleteName: participantName(bronzeAthleteId, nameById),
      medal: 'BRONZE',
    });
  }

  return {
    format,
    totalFights,
    completedFights,
    isComplete,
    placements,
    medalists: {
      gold: placements.find((row) => row.medal === 'GOLD') ?? null,
      silver: placements.find((row) => row.medal === 'SILVER') ?? null,
      bronze: placements.filter((row) => row.medal === 'BRONZE'),
    },
    standings: null,
    tieUnresolved: false,
  };
}
