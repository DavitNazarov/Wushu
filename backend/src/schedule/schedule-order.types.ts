import type { FightStatus } from '@prisma/client';
import type { CompetitionFormat } from '../draw/competition-format';

type FightAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  firstNameKa?: string | null;
  lastNameKa?: string | null;
};

type FightMat = {
  id: string;
  name: string;
  order?: number | null;
};

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
};

export type ScheduleDisplayAthlete = FightAthlete | null | undefined;
