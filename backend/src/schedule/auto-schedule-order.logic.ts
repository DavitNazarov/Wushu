import {
  buildFightCandidates,
  compareFightCandidate,
  isFightPlayable,
  type FightCandidate,
} from './schedule-fight-candidates.logic';
import type { ScheduleSourceFight } from './schedule-order.types';

export const MIN_AUTO_SCHEDULE_FIGHT_GAP = 10;

type CandidateRestConflict = {
  athleteIds: string[];
  violatedAthleteIds: string[];
  previousFightIds: string[];
  actualFightGap: number;
  missingFightCount: number;
  totalMissingFightCount: number;
};

export type AutoScheduleConflict = {
  fightId: string;
  scheduledOrder: number;
  athleteIds: string[];
  violatedAthleteIds: string[];
  previousFightIds: string[];
  requiredFightGap: number;
  actualFightGap: number;
  missingFightCount: number;
};

export type AutoScheduleDiagnostics = {
  minFightGap: number;
  fullySatisfied: boolean;
  conflictCount: number;
  conflicts: AutoScheduleConflict[];
};

export type AutoScheduleOrderPlan = {
  fights: ScheduleSourceFight[];
  diagnostics: AutoScheduleDiagnostics;
};

function getFightAthleteIds(fight: ScheduleSourceFight): string[] {
  return [...new Set([fight.redAthleteId, fight.blueAthleteId].filter(Boolean))] as string[];
}

function dependenciesSatisfied(
  candidate: FightCandidate,
  scheduledFightIds: Set<string>,
  candidateByFightId: Map<string, FightCandidate>,
): boolean {
  const dependencyIds = [candidate.redSourceFightId, candidate.blueSourceFightId].filter(
    Boolean,
  ) as string[];

  return dependencyIds.every(
    (dependencyId) =>
      !candidateByFightId.has(dependencyId) || scheduledFightIds.has(dependencyId),
  );
}

function getRestConflict(input: {
  candidate: FightCandidate;
  nextScheduleOrder: number;
  lastScheduleOrderByAthleteId: Map<string, number>;
  lastFightIdByAthleteId: Map<string, string>;
}): CandidateRestConflict | null {
  const athleteIds = getFightAthleteIds(input.candidate.fight);
  const violations = athleteIds
    .map((athleteId) => {
      const lastScheduleOrder = input.lastScheduleOrderByAthleteId.get(athleteId);
      if (lastScheduleOrder == null) return null;

      const actualFightGap = input.nextScheduleOrder - lastScheduleOrder - 1;
      if (actualFightGap >= MIN_AUTO_SCHEDULE_FIGHT_GAP) return null;

      return {
        athleteId,
        previousFightId: input.lastFightIdByAthleteId.get(athleteId) ?? null,
        actualFightGap,
        missingFightCount: MIN_AUTO_SCHEDULE_FIGHT_GAP - actualFightGap,
      };
    })
    .filter(
      (
        value,
      ): value is {
        athleteId: string;
        previousFightId: string | null;
        actualFightGap: number;
        missingFightCount: number;
      } => value != null,
    );

  if (violations.length === 0) return null;

  return {
    athleteIds,
    violatedAthleteIds: violations.map((item) => item.athleteId),
    previousFightIds: violations
      .map((item) => item.previousFightId)
      .filter((value): value is string => value != null),
    actualFightGap: Math.min(...violations.map((item) => item.actualFightGap)),
    missingFightCount: Math.max(...violations.map((item) => item.missingFightCount)),
    totalMissingFightCount: violations.reduce(
      (sum, item) => sum + item.missingFightCount,
      0,
    ),
  };
}

function compareConflictChoice(
  left: { candidate: FightCandidate; conflict: CandidateRestConflict },
  right: { candidate: FightCandidate; conflict: CandidateRestConflict },
): number {
  if (left.conflict.missingFightCount !== right.conflict.missingFightCount) {
    return left.conflict.missingFightCount - right.conflict.missingFightCount;
  }

  if (
    left.conflict.violatedAthleteIds.length !== right.conflict.violatedAthleteIds.length
  ) {
    return (
      left.conflict.violatedAthleteIds.length -
      right.conflict.violatedAthleteIds.length
    );
  }

  if (
    left.conflict.totalMissingFightCount !== right.conflict.totalMissingFightCount
  ) {
    return (
      left.conflict.totalMissingFightCount - right.conflict.totalMissingFightCount
    );
  }

  if (left.conflict.actualFightGap !== right.conflict.actualFightGap) {
    return right.conflict.actualFightGap - left.conflict.actualFightGap;
  }

  return compareFightCandidate(left.candidate, right.candidate);
}

export function planAutoScheduleOrder(
  fights: ScheduleSourceFight[],
): AutoScheduleOrderPlan {
  const sortedCandidates = buildFightCandidates(fights)
    .filter((candidate) =>
      isFightPlayable({
        redAthleteId: candidate.fight.redAthleteId,
        blueAthleteId: candidate.fight.blueAthleteId,
        winnerAthleteId: candidate.fight.winnerAthleteId,
        status: candidate.fight.status,
      }),
    )
    .sort(compareFightCandidate);

  const candidateByFightId = new Map(
    sortedCandidates.map((candidate) => [candidate.fight.id, candidate]),
  );
  const remainingFightIds = new Set(sortedCandidates.map((candidate) => candidate.fight.id));
  const scheduledFightIds = new Set<string>();
  const scheduledCandidates: FightCandidate[] = [];
  const diagnostics: AutoScheduleConflict[] = [];
  const lastScheduleOrderByAthleteId = new Map<string, number>();
  const lastFightIdByAthleteId = new Map<string, string>();

  while (remainingFightIds.size > 0) {
    const readyCandidates = sortedCandidates.filter(
      (candidate) =>
        remainingFightIds.has(candidate.fight.id) &&
        dependenciesSatisfied(candidate, scheduledFightIds, candidateByFightId),
    );
    const candidatePool =
      readyCandidates.length > 0
        ? readyCandidates
        : sortedCandidates.filter((candidate) => remainingFightIds.has(candidate.fight.id));
    const nextScheduleOrder = scheduledCandidates.length + 1;
    const restSafeCandidates = candidatePool.filter(
      (candidate) =>
        getRestConflict({
          candidate,
          nextScheduleOrder,
          lastScheduleOrderByAthleteId,
          lastFightIdByAthleteId,
        }) == null,
    );

    let chosenCandidate = restSafeCandidates[0] ?? null;
    let chosenConflict: CandidateRestConflict | null = null;

    if (!chosenCandidate) {
      const fallbackChoices = candidatePool
        .map((candidate) => ({
          candidate,
          conflict: getRestConflict({
            candidate,
            nextScheduleOrder,
            lastScheduleOrderByAthleteId,
            lastFightIdByAthleteId,
          }),
        }))
        .filter(
          (
            value,
          ): value is { candidate: FightCandidate; conflict: CandidateRestConflict } =>
            value.conflict != null,
        )
        .sort(compareConflictChoice);

      const fallbackChoice = fallbackChoices[0];
      if (!fallbackChoice) {
        break;
      }

      chosenCandidate = fallbackChoice.candidate;
      chosenConflict = fallbackChoice.conflict;
    }

    scheduledCandidates.push(chosenCandidate);
    remainingFightIds.delete(chosenCandidate.fight.id);
    scheduledFightIds.add(chosenCandidate.fight.id);

    if (chosenConflict) {
      diagnostics.push({
        fightId: chosenCandidate.fight.id,
        scheduledOrder: nextScheduleOrder,
        athleteIds: chosenConflict.athleteIds,
        violatedAthleteIds: chosenConflict.violatedAthleteIds,
        previousFightIds: chosenConflict.previousFightIds,
        requiredFightGap: MIN_AUTO_SCHEDULE_FIGHT_GAP,
        actualFightGap: chosenConflict.actualFightGap,
        missingFightCount: chosenConflict.missingFightCount,
      });
    }

    for (const athleteId of getFightAthleteIds(chosenCandidate.fight)) {
      lastScheduleOrderByAthleteId.set(athleteId, nextScheduleOrder);
      lastFightIdByAthleteId.set(athleteId, chosenCandidate.fight.id);
    }
  }

  return {
    fights: scheduledCandidates.map((candidate) => candidate.fight),
    diagnostics: {
      minFightGap: MIN_AUTO_SCHEDULE_FIGHT_GAP,
      fullySatisfied: diagnostics.length === 0,
      conflictCount: diagnostics.length,
      conflicts: diagnostics,
    },
  };
}
