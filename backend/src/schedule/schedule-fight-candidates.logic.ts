import type { FightStatus } from '@prisma/client';
import {
  resolveCompetitionFormat,
  type CompetitionFormat,
} from '../draw/competition-format';
import type { ScheduleDisplayAthlete, ScheduleSourceFight } from './schedule-order.types';

export type FightCandidate = {
  fight: ScheduleSourceFight;
  bucketKey: string;
  categoryName: string;
  ageGroupName: string | null;
  competitionFormat: CompetitionFormat;
  bracketRoundLabel: string;
  stagePriority: number;
  ageGroupSortOrder: number;
  weightSortOrder: number;
  redSourceFightId: string | null;
  blueSourceFightId: string | null;
};

function getBucketKey(fight: ScheduleSourceFight): string {
  return (
    fight.bracketId ?? fight.eventWeightCategoryId ?? fight.categoryCode ?? fight.id
  );
}

export function displayName(input: {
  athlete: ScheduleDisplayAthlete;
  sourceScheduleOrder: number | null;
}): string {
  if (input.athlete) {
    return `${input.athlete.firstName} ${input.athlete.lastName}`;
  }
  if (input.sourceScheduleOrder != null) {
    return `Winner of ${input.sourceScheduleOrder}`;
  }
  return 'TBD';
}

export function displayNameKa(input: {
  athlete: ScheduleDisplayAthlete;
}): string | null {
  if (input.athlete?.firstNameKa && input.athlete?.lastNameKa) {
    return `${input.athlete.firstNameKa} ${input.athlete.lastNameKa}`;
  }
  return null;
}

function bracketRoundLabel(input: {
  round: number;
  maxRound: number;
  competitionFormat: CompetitionFormat;
}): string {
  if (input.competitionFormat === 'ROUND_ROBIN') return 'Round robin';
  const distanceToFinal = input.maxRound - input.round;
  if (distanceToFinal <= 0) return 'Final';
  if (distanceToFinal === 1) return 'Semifinal';
  if (distanceToFinal === 2) return 'Quarterfinal';
  if (distanceToFinal === 3) return 'Round of 16';
  return `Round ${input.round}`;
}

export function isFightPlayable(fight: {
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId?: string | null;
  status: FightStatus;
}): boolean {
  if (!fight.redAthleteId || !fight.blueAthleteId) return false;
  if (fight.redAthleteId === fight.blueAthleteId) return false;
  if (fight.winnerAthleteId) return false;
  return (
    fight.status === 'QUEUED' ||
    fight.status === 'ON_DECK' ||
    fight.status === 'IN_PROGRESS' ||
    fight.status === 'PAUSED'
  );
}

function isScheduleVisibleFight(input: {
  fight: ScheduleSourceFight;
  openingRound: number;
  hasSourceDependencies: boolean;
}): boolean {
  const redKnown = !!input.fight.redAthleteId;
  const blueKnown = !!input.fight.blueAthleteId;

  if (!redKnown && !blueKnown && !input.hasSourceDependencies) return false;
  if (input.fight.round === input.openingRound && redKnown !== blueKnown) return false;

  return true;
}

export function buildFightCandidates(fights: ScheduleSourceFight[]): FightCandidate[] {
  const fightsByBucket = new Map<string, ScheduleSourceFight[]>();

  for (const fight of fights) {
    const bucketKey = getBucketKey(fight);
    const bucket = fightsByBucket.get(bucketKey) ?? [];
    bucket.push(fight);
    fightsByBucket.set(bucketKey, bucket);
  }

  const candidates: FightCandidate[] = [];

  for (const [bucketKey, bucket] of fightsByBucket.entries()) {
    const openingRound = bucket.reduce(
      (min, fight) => Math.min(min, fight.round),
      bucket[0]?.round ?? 0,
    );
    const maxRound = bucket.reduce(
      (max, fight) => Math.max(max, fight.round),
      bucket[0]?.round ?? 0,
    );
    const athleteIds = new Set<string>();
    const byRoundBout = new Map(
      bucket.map((fight) => [`${fight.round}:${fight.boutNo}`, fight]),
    );

    for (const fight of bucket) {
      if (fight.redAthleteId) athleteIds.add(fight.redAthleteId);
      if (fight.blueAthleteId) athleteIds.add(fight.blueAthleteId);
    }

    const competitionFormat = resolveCompetitionFormat({
      athleteCount: athleteIds.size,
    });
    const ageGroupSortOrder =
      bucket[0]?.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
        ?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const weightSortOrder =
      bucket[0]?.eventWeightCategory?.categoryTemplateWeight?.sortOrder ??
      Number.MAX_SAFE_INTEGER;
    const categoryName =
      bucket[0]?.eventWeightCategory?.categoryTemplateWeight?.name ??
      bucket[0]?.categoryCode ??
      bucketKey;
    const ageGroupName =
      bucket[0]?.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup?.name ??
      null;

    for (const fight of bucket) {
      const redSourceFightId =
        fight.round > openingRound
          ? byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2 - 1}`)?.id ?? null
          : null;
      const blueSourceFightId =
        fight.round > openingRound
          ? byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2}`)?.id ?? null
          : null;
      const hasSourceDependencies = !!redSourceFightId || !!blueSourceFightId;

      if (
        !isScheduleVisibleFight({
          fight,
          openingRound,
          hasSourceDependencies,
        })
      ) {
        continue;
      }

      const stagePriority =
        competitionFormat === 'ROUND_ROBIN'
          ? Number.MAX_SAFE_INTEGER - fight.boutNo
          : maxRound - fight.round;

      candidates.push({
        fight,
        bucketKey,
        categoryName,
        ageGroupName,
        competitionFormat,
        bracketRoundLabel: bracketRoundLabel({
          round: fight.round,
          maxRound,
          competitionFormat,
        }),
        stagePriority,
        ageGroupSortOrder,
        weightSortOrder,
        redSourceFightId,
        blueSourceFightId,
      });
    }
  }

  return candidates;
}

export function compareFightCandidate(left: FightCandidate, right: FightCandidate): number {
  if (left.stagePriority !== right.stagePriority) {
    return right.stagePriority - left.stagePriority;
  }

  if (left.ageGroupSortOrder !== right.ageGroupSortOrder) {
    return left.ageGroupSortOrder - right.ageGroupSortOrder;
  }

  if (left.weightSortOrder !== right.weightSortOrder) {
    return left.weightSortOrder - right.weightSortOrder;
  }

  if (left.bucketKey !== right.bucketKey) {
    return left.bucketKey.localeCompare(right.bucketKey);
  }

  if (left.fight.round !== right.fight.round) {
    return left.fight.round - right.fight.round;
  }

  if (left.fight.boutNo !== right.fight.boutNo) {
    return left.fight.boutNo - right.fight.boutNo;
  }

  return left.fight.id.localeCompare(right.fight.id);
}
