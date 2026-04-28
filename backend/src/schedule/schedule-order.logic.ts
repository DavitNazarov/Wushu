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

export type { BuiltScheduleRow, ScheduleSourceFight } from './schedule-order.types';

export function sortFightsForAutoSchedule(
  fights: ScheduleSourceFight[],
): ScheduleSourceFight[] {
  return planAutoScheduleOrder(fights).fights;
}

export function buildScheduleRows(fights: ScheduleSourceFight[]): BuiltScheduleRow[] {
  const sortedCandidates = buildFightCandidates(fights).sort(compareFightCandidate);
  const scheduleOrderByFightId = new Map<string, number>();

  sortedCandidates.forEach((candidate, index) => {
    scheduleOrderByFightId.set(candidate.fight.id, index + 1);
  });

  return sortedCandidates.map((candidate) => {
    const redSourceScheduleOrder = candidate.redSourceFightId
      ? scheduleOrderByFightId.get(candidate.redSourceFightId) ?? null
      : null;
    const blueSourceScheduleOrder = candidate.blueSourceFightId
      ? scheduleOrderByFightId.get(candidate.blueSourceFightId) ?? null
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
      blueDisplayNameKa: displayNameKa({ athlete: candidate.fight.blueAthlete }),
      redSourceScheduleOrder,
      blueSourceScheduleOrder,
      isPlayable: isFightPlayable({
        redAthleteId: candidate.fight.redAthleteId,
        blueAthleteId: candidate.fight.blueAthleteId,
        winnerAthleteId: candidate.fight.winnerAthleteId,
        status: candidate.fight.status,
      }),
      isScheduled: (candidate.fight.sessionId != null && candidate.fight.orderInSession != null) || (candidate.fight.matId != null && candidate.fight.orderInMat != null),
      status: candidate.fight.status,
      matId: candidate.fight.matId,
      matName: candidate.fight.mat?.name ?? null,
      matOrder: candidate.fight.mat?.order ?? null,
      orderInMat: candidate.fight.orderInMat,
      scheduledAt: candidate.fight.scheduledStartTime,
      sessionId: candidate.fight.sessionId,
      orderInSession: (candidate.fight as { orderInSession?: number | null }).orderInSession ?? null,
    };
  });
}
