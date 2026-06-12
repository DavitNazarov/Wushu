import { planAutoScheduleOrder } from './auto-schedule-order.logic';
import {
  buildFightCandidates,
  compareFightCandidate,
  displayName,
  displayNameKa,
  isFightPlayable,
} from './schedule-fight-candidates.logic';
import type {
  BuiltScheduleRow,
  ScheduleSourceFight,
} from './schedule-order.types';

export type {
  BuiltScheduleRow,
  ScheduleSourceFight,
} from './schedule-order.types';

// Pure ordering helpers consumed by ScheduleService. No DB.

// Thin pass-through used by the auto-scheduler — kept as a separate function
// so callers can ignore the planAutoScheduleOrder diagnostics output.
export function sortFightsForAutoSchedule(
  fights: ScheduleSourceFight[],
): ScheduleSourceFight[] {
  return planAutoScheduleOrder(fights).fights;
}

// Build the canonical schedule rows the UI renders. Pipeline:
//   1. Promote each Fight to a "candidate" with computed metadata
//      (category, bracket round label, source bouts).
//   2. Sort candidates with compareFightCandidate to produce the global
//      bout sequence.
//   3. Assign a scheduleOrder (1-based index) per fight and use it to fill
//      "Winner of N" labels for downstream fights whose athletes aren't
//      attached yet.
// Output is a flat row per fight with both EN and KA display names plus
// every field the admin/public schedule tables need.
export function buildScheduleRows(
  fights: ScheduleSourceFight[],
): BuiltScheduleRow[] {
  const sortedCandidates = buildFightCandidates(fights).sort(
    compareFightCandidate,
  );
  const scheduleOrderByFightId = new Map<string, number>();

  sortedCandidates.forEach((candidate, index) => {
    scheduleOrderByFightId.set(candidate.fight.id, index + 1);
  });

  return sortedCandidates.map((candidate) => {
    const redSourceScheduleOrder = candidate.redSourceFightId
      ? (scheduleOrderByFightId.get(candidate.redSourceFightId) ?? null)
      : null;
    const blueSourceScheduleOrder = candidate.blueSourceFightId
      ? (scheduleOrderByFightId.get(candidate.blueSourceFightId) ?? null)
      : null;

    return {
      id: candidate.fight.id,
      categoryCode: candidate.fight.categoryCode,
      categoryName: candidate.categoryName,
      ageGroupName: candidate.ageGroupName,
      competitionFormat: candidate.competitionFormat,
      bracketRoundLabel: candidate.bracketRoundLabel,
      bracketFightNumber: candidate.fight.boutNo,
      scheduleOrder: scheduleOrderByFightId.get(candidate.fight.id) ?? null,
      redDisplayName: displayName({
        athlete: candidate.fight.redAthlete,
        sourceScheduleOrder: redSourceScheduleOrder,
      }),
      blueDisplayName: displayName({
        athlete: candidate.fight.blueAthlete,
        sourceScheduleOrder: blueSourceScheduleOrder,
      }),
      redDisplayNameKa: displayNameKa({ athlete: candidate.fight.redAthlete }),
      blueDisplayNameKa: displayNameKa({
        athlete: candidate.fight.blueAthlete,
      }),
      redSourceScheduleOrder,
      blueSourceScheduleOrder,
      isPlayable: isFightPlayable({
        redAthleteId: candidate.fight.redAthleteId,
        blueAthleteId: candidate.fight.blueAthleteId,
        winnerAthleteId: candidate.fight.winnerAthleteId,
        status: candidate.fight.status,
      }),
      isScheduled:
        (candidate.fight.sessionId != null &&
          candidate.fight.orderInSession != null) ||
        (candidate.fight.matId != null && candidate.fight.orderInMat != null),
      status: candidate.fight.status,
      matId: candidate.fight.matId,
      matName: candidate.fight.mat?.name ?? null,
      matOrder: candidate.fight.mat?.order ?? null,
      orderInMat: candidate.fight.orderInMat,
      scheduledAt: candidate.fight.scheduledStartTime,
      sessionId: candidate.fight.sessionId,
      orderInSession:
        (candidate.fight as { orderInSession?: number | null })
          .orderInSession ?? null,
      winnerCorner: candidate.fight.winnerAthleteId
        ? candidate.fight.winnerAthleteId === candidate.fight.redAthleteId
          ? 'RED'
          : candidate.fight.winnerAthleteId === candidate.fight.blueAthleteId
            ? 'BLUE'
            : null
        : null,
    };
  });
}
