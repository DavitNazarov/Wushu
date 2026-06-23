import {
  resolveCompetitionFormat,
  type CompetitionFormat,
} from '../draw/competition-format';
import { isScheduleVisibleFight } from '../competition/fight-visibility';
import type {
  ScheduleDisplayAthlete,
  ScheduleSourceFight,
} from './schedule-order.types';

// isFightPlayable is part of this module's public surface — schedule-order
// and auto-schedule-order import it from here. Re-export the canonical impl
// so those callers stay unchanged.
export { isFightPlayable } from '../competition/fight-visibility';

// Pure schedule-ordering primitives used by buildScheduleRows and the
// auto-scheduler. No Prisma — all data comes in as plain objects.

// Enriched view of a fight + everything needed to compare/sort it.
// stagePriority drives the global "Finals first, then SF, then QF" order.
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

// All fights inside the same bracket / weight category / category code get
// the same bucket so their internal round structure can be reasoned about
// together. Falls back to fight.id when no broader grouping is available.
function getBucketKey(fight: ScheduleSourceFight): string {
  return (
    fight.bracketId ??
    fight.eventWeightCategoryId ??
    fight.categoryCode ??
    fight.id
  );
}

// Build the EN display string for a participant cell in the schedule:
//   real athlete             → "First Last"
//   upstream not yet decided → "Winner of N" using the source bout's scheduleOrder
//   nothing                  → "TBD"
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

// Georgian display name only when BOTH KA fields are present — partial KA
// data would render as a mongrel "GeorgianFirst LatinLast". Returns null
// instead so the frontend can fall back to the EN string.
// NOTE: there's no KA "Winner of N" — we only ship a KA name for real athletes.
export function displayNameKa(input: {
  athlete: ScheduleDisplayAthlete;
}): string | null {
  if (input.athlete?.firstNameKa && input.athlete?.lastNameKa) {
    return `${input.athlete.firstNameKa} ${input.athlete.lastNameKa}`;
  }
  return null;
}

// Convert (round, maxRound, format) into the round-name shown alongside each
// schedule row: "Final" / "Semifinal" / "Quarterfinal" / "Round of 16" /
// "Round N", with a separate "Round robin" label for that format.
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

// Turn raw fights into FightCandidate entries:
//   1. Group fights by bucket key (bracket / category / etc.).
//   2. Per bucket, compute opening + max round and the unique athlete count
//      so we can pick a competition format.
//   3. For each fight in the bucket, infer red/blue source bouts (the
//      one-round-earlier feeders), then drop schedule-hidden fights.
//   4. Pack everything into FightCandidate with a stagePriority that puts
//      finals before semifinals before quarterfinals etc.
// stagePriority for round-robin uses (MAX_SAFE - boutNo) so all round-robin
// matchups sort last but keep their internal boutNo order.
export function buildFightCandidates(
  fights: ScheduleSourceFight[],
): FightCandidate[] {
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
      bucket[0]?.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
        ?.name ?? null;

    for (const fight of bucket) {
      const redSourceFightId =
        fight.round > openingRound
          ? (byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2 - 1}`)
              ?.id ?? null)
          : null;
      const blueSourceFightId =
        fight.round > openingRound
          ? (byRoundBout.get(`${fight.round - 1}:${fight.boutNo * 2}`)?.id ??
            null)
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

// Total-ordering comparator. Tie-breaks are stable on every keys-path:
//   1. stagePriority (DESCENDING so finals come first),
//   2. age group sort order,
//   3. weight sort order,
//   4. bucket key (alphabetical fallback),
//   5. round, boutNo,
//   6. fight id (final tie-break for deterministic output).
// Pure: no DB or side effects — safe to call in tight loops.
export function compareFightCandidate(
  left: FightCandidate,
  right: FightCandidate,
): number {
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
