import {
  buildFightCandidates,
  compareFightCandidate,
  isFightPlayable,
  type FightCandidate,
} from './schedule-fight-candidates.logic';
import type { ScheduleSourceFight } from './schedule-order.types';

// Auto-scheduler ordering core. Pure: takes raw fights, returns a sequence
// + diagnostics. Used by both /schedule/generate (session bucketing) and
// /schedule/auto (time-aware variant) for the underlying running order.

// Required minimum number of fights between two bouts for the same athlete.
// 10 is the festival convention — enough recovery time at typical bout
// lengths. Surfaced in diagnostics so the UI can show "needs 10, got 3".
export const MIN_AUTO_SCHEDULE_FIGHT_GAP = 10;

// Internal accumulator describing one candidate's rest-window failure.
// Distinct from AutoScheduleConflict (the public diagnostic) because we
// compute it many times per fight to pick the least-bad fallback.
type CandidateRestConflict = {
  athleteIds: string[];
  violatedAthleteIds: string[];
  previousFightIds: string[];
  actualFightGap: number;
  missingFightCount: number;
  totalMissingFightCount: number;
};

// Public diagnostic record for one rest-violation that ended up in the plan.
// Reported back through the response so the UI can flag the affected fight.
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

// Summary stats for an auto-schedule run. fullySatisfied is the at-a-glance
// "did every athlete get their rest?" flag the UI uses for a green/red banner.
export type AutoScheduleDiagnostics = {
  minFightGap: number;
  fullySatisfied: boolean;
  conflictCount: number;
  conflicts: AutoScheduleConflict[];
};

// Plan output: the chosen running order PLUS the diagnostics. Callers can
// discard the diagnostics if they don't care.
export type AutoScheduleOrderPlan = {
  fights: ScheduleSourceFight[];
  diagnostics: AutoScheduleDiagnostics;
};

// Distinct athlete ids on a fight. Both sides of a BYE / same-athlete edge
// case get deduped here.
function getFightAthleteIds(fight: ScheduleSourceFight): string[] {
  return [
    ...new Set([fight.redAthleteId, fight.blueAthleteId].filter(Boolean)),
  ] as string[];
}

// "Are this fight's upstream feeders already in the plan?" Used to keep the
// running order DAG-valid — we never schedule a downstream fight before its
// red/blue source bouts. Dependencies on fights NOT in candidateByFightId
// (e.g. byes / unknown sources) count as satisfied.
function dependenciesSatisfied(
  candidate: FightCandidate,
  scheduledFightIds: Set<string>,
  candidateByFightId: Map<string, FightCandidate>,
): boolean {
  const dependencyIds = [
    candidate.redSourceFightId,
    candidate.blueSourceFightId,
  ].filter(Boolean) as string[];

  return dependencyIds.every(
    (dependencyId) =>
      !candidateByFightId.has(dependencyId) ||
      scheduledFightIds.has(dependencyId),
  );
}

// Check whether placing `candidate` at scheduleOrder=nextScheduleOrder would
// violate the MIN_AUTO_SCHEDULE_FIGHT_GAP for any of its athletes. Returns
// null when safe, otherwise an aggregated record describing the worst (min)
// gap and the affected athletes. Used both to filter "safe" candidates and
// to rank fallback choices when no safe candidate exists.
function getRestConflict(input: {
  candidate: FightCandidate;
  nextScheduleOrder: number;
  lastScheduleOrderByAthleteId: Map<string, number>;
  lastFightIdByAthleteId: Map<string, string>;
}): CandidateRestConflict | null {
  const athleteIds = getFightAthleteIds(input.candidate.fight);
  const violations = athleteIds
    .map((athleteId) => {
      const lastScheduleOrder =
        input.lastScheduleOrderByAthleteId.get(athleteId);
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
    missingFightCount: Math.max(
      ...violations.map((item) => item.missingFightCount),
    ),
    totalMissingFightCount: violations.reduce(
      (sum, item) => sum + item.missingFightCount,
      0,
    ),
  };
}

// Ranking comparator for "least-bad" fallback candidates when nothing safe
// is available. Priorities, in order:
//   1. min missingFightCount (smallest shortfall first),
//   2. fewer violated athletes,
//   3. smaller total missing fight-count across athletes,
//   4. larger actualFightGap (closer to the rule),
//   5. base candidate ordering (compareFightCandidate as the final tie-break).
function compareConflictChoice(
  left: { candidate: FightCandidate; conflict: CandidateRestConflict },
  right: { candidate: FightCandidate; conflict: CandidateRestConflict },
): number {
  if (left.conflict.missingFightCount !== right.conflict.missingFightCount) {
    return left.conflict.missingFightCount - right.conflict.missingFightCount;
  }

  if (
    left.conflict.violatedAthleteIds.length !==
    right.conflict.violatedAthleteIds.length
  ) {
    return (
      left.conflict.violatedAthleteIds.length -
      right.conflict.violatedAthleteIds.length
    );
  }

  if (
    left.conflict.totalMissingFightCount !==
    right.conflict.totalMissingFightCount
  ) {
    return (
      left.conflict.totalMissingFightCount -
      right.conflict.totalMissingFightCount
    );
  }

  if (left.conflict.actualFightGap !== right.conflict.actualFightGap) {
    return right.conflict.actualFightGap - left.conflict.actualFightGap;
  }

  return compareFightCandidate(left.candidate, right.candidate);
}

// Greedy scheduler. Loop:
//   1. Compute ready candidates: those whose source bouts are already in.
//      If none are ready (cycle / orphan source), fall back to anything left.
//   2. Filter to candidates that DON'T violate min fight gap. If any exist,
//      pick the first by compareFightCandidate ordering.
//   3. Otherwise pick the least-bad fallback per compareConflictChoice and
//      record a diagnostic.
//   4. Commit the candidate, update last-fight-per-athlete bookkeeping.
// Returns the chosen running order plus aggregated diagnostics.
export function planAutoScheduleOrder(
  fights: ScheduleSourceFight[],
): AutoScheduleOrderPlan {
  const sortedCandidates = buildFightCandidates(fights)
    .filter(
      (candidate) =>
        isFightPlayable({
          redAthleteId: candidate.fight.redAthleteId,
          blueAthleteId: candidate.fight.blueAthleteId,
          winnerAthleteId: candidate.fight.winnerAthleteId,
          status: candidate.fight.status,
        }) &&
        // BF-4: the auto-scheduler may only (re)assign fights that have NOT
        // started yet. A fight being contested (IN_PROGRESS/PAUSED) keeps its
        // slot — moving it mid-bout would corrupt the live running order.
        (candidate.fight.status === 'QUEUED' ||
          candidate.fight.status === 'ON_DECK'),
    )
    .sort(compareFightCandidate);

  const candidateByFightId = new Map(
    sortedCandidates.map((candidate) => [candidate.fight.id, candidate]),
  );
  const remainingFightIds = new Set(
    sortedCandidates.map((candidate) => candidate.fight.id),
  );
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
        : sortedCandidates.filter((candidate) =>
            remainingFightIds.has(candidate.fight.id),
          );
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
          ): value is {
            candidate: FightCandidate;
            conflict: CandidateRestConflict;
          } => value.conflict != null,
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
