import type { FightStatus } from '@prisma/client';
import type { CompetitionFormat } from '../draw/competition-format';

// Input/output types for schedule-order.logic. Hand-rolled rather than
// Prisma-inferred because the same shapes flow through the pure logic
// helpers and need to stay decoupled from Prisma types.

// Minimal athlete projection — names only, plus optional KA variants for
// the bilingual display.
type FightAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  firstNameKa?: string | null;
  lastNameKa?: string | null;
};

// Slim mat projection used to fill matName/matOrder in schedule rows.
type FightMat = {
  id: string;
  name: string;
  order?: number | null;
};

// Joined category metadata. Optional chains throughout because not every
// fight has a full category attached (e.g. very old data).
type FightCategory = {
  categoryTemplateWeight?: {
    name: string;
    sortOrder: number;
  } | null;
  eventAgeGroup?: {
    categoryTemplateAgeGroup?: {
      name: string;
      sortOrder: number;
    } | null;
  } | null;
};

// Shape ScheduleService passes into the pure logic layer. Mirrors what
// Prisma returns from getSchedule's include block, but written by hand so
// the logic file has no Prisma import.
export type ScheduleSourceFight = {
  id: string;
  bracketId: string | null;
  categoryCode: string;
  eventWeightCategoryId: string | null;
  round: number;
  boutNo: number;
  status: FightStatus;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId: string | null;
  matId: string | null;
  orderInMat: number | null;
  scheduledStartTime: Date | null;
  sessionId: string | null;
  orderInSession?: number | null;
  redAthlete?: FightAthlete | null;
  blueAthlete?: FightAthlete | null;
  winnerAthlete?: FightAthlete | null;
  mat?: FightMat | null;
  eventWeightCategory?: FightCategory | null;
};

// Output shape from buildScheduleRows. One row per visible fight, ready
// for the schedule UI: pre-computed display strings, bilingual variants,
// playability flag, scheduled time, and mat/session placement.
export type BuiltScheduleRow = {
  id: string;
  categoryCode: string;
  categoryName: string;
  ageGroupName: string | null;
  competitionFormat: CompetitionFormat;
  bracketRoundLabel: string;
  bracketFightNumber: number;
  scheduleOrder: number | null;
  redDisplayName: string;
  blueDisplayName: string;
  redDisplayNameKa: string | null;
  blueDisplayNameKa: string | null;
  redSourceScheduleOrder: number | null;
  blueSourceScheduleOrder: number | null;
  isPlayable: boolean;
  isScheduled: boolean;
  status: FightStatus;
  matId: string | null;
  matName: string | null;
  matOrder: number | null;
  orderInMat: number | null;
  scheduledAt: Date | null;
  sessionId: string | null;
  orderInSession: number | null;
  winnerCorner: 'RED' | 'BLUE' | null;
};

// Loose alias so displayName/displayNameKa can accept whatever shape the
// caller has (joined athlete, missing relation, or undefined).
export type ScheduleDisplayAthlete = FightAthlete | null | undefined;
