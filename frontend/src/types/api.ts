export type EventLifecycle =
  | 'REG_OPEN'
  | 'WEIGHIN'
  | 'LOCKED'
  | 'DRAWN'
  | 'PUBLISHED'
  | 'LIVE'
  | 'COMPLETED';

export type RegistrationWindowStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

export type RulesetStatus = 'DRAFT' | 'ACTIVE';
export type RegistrationStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type WeighInDecision = 'PASS' | 'REWEIGH' | 'FAIL' | 'ONE_HOUR';
export type FightStatus = 'QUEUED' | 'ON_DECK' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETE' | 'CONFIRMED';
export type WinMethod = 'POINTS' | 'KO' | 'DQ' | 'WO';
export type AthleteSex = 'MALE' | 'FEMALE';
export type SubmissionStatus = 'NEW' | 'HANDLED';

export interface EventDates {
  range: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
  };
  registrationDays: string[]; // YYYY-MM-DD
  fightDays: string[]; // YYYY-MM-DD
  registrationWindow?: {
    opensAt: string; // YYYY-MM-DD
    closesAt?: string; // YYYY-MM-DD
  } | null;
}

export interface EventCreateInput {
  name: string;
  slug: string;
  location: string;
  timezone: string;
  autoAdvanceStage?: boolean;
  dates: EventDates;
  registrationWindow?: {
    opensAt: string; // YYYY-MM-DD
    closesAt?: string; // YYYY-MM-DD
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface EventRow {
  id: string;
  name: string;
  slug: string;
  lifecycle: EventLifecycle;
  location: string | null;
  timezone: string;
  published: boolean;
  autoAdvanceStage: boolean;
  registrationStartDate: string;
  registrationEndDate: string;
  weighInStartDate: string | null;
  weighInEndDate: string | null;
  competitionStartDate: string;
  competitionEndDate: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationStatus: RegistrationWindowStatus;
  dates?: EventDates | null;
  createdAt: string;
  updatedAt: string;
}

export interface RulesetRow {
  id: string;
  name: string;
  version: number;
  status: RulesetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RulesetWeightCategoryRow {
  id: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
}

export interface RulesetAgeGroupRow {
  id: string;
  code: string;
  name: string;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  weightCategories: RulesetWeightCategoryRow[];
}

export interface EventWeightCategoryRow {
  id: string;
  rulesetWeightCategoryId: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
}

export interface EventAgeGroupRow {
  id: string;
  rulesetAgeGroupId: string;
  code: string;
  name: string;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  weightCategories: EventWeightCategoryRow[];
}

export interface EventCategoriesResponse {
  eventId: string;
  ageGroups: EventAgeGroupRow[];
}

export type CategorySelection = {
  rulesetId: string;
  ageGroups: Array<{ rulesetAgeGroupId: string; weightCategoryIds: string[] }>;
};

export interface ClubRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
}

export interface AthleteRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  sex: AthleteSex | null;
  documentId: string | null;
  clubId: string | null;
  club?: ClubRow | null;
  _dedupeCount?: number;
}

export interface RegistrationRow {
  id: string;
  eventId: string;
  athleteId: string;
  clubId: string | null;
  categoryCode: string;
  categoryLabel?: string | null;
  eventWeightCategoryId?: string | null;
  status: RegistrationStatus;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
  athlete?: { id: string; firstName: string; lastName: string; dateOfBirth: string };
  club?: ClubRow | null;
}

export interface WeighInResult {
  id: string;
  registrationId: string;
  weight: number;
  decision: WeighInDecision;
  reason: string | null;
  override: boolean;
  createdAt: string;
}

export interface BracketRow {
  id: string;
  eventId: string;
  categoryCode: string;
  seed?: number | null;
  fights?: FightRow[];
}

export interface FightRow {
  id: string;
  bracketId?: string | null;
  categoryCode?: string;
  eventWeightCategoryId?: string | null;
  roundDurationSeconds?: number | null;
  round: number;
  boutNo: number;
  redAthleteId?: string | null;
  blueAthleteId?: string | null;
  redAthlete?: { id: string; firstName: string; lastName: string } | null;
  blueAthlete?: { id: string; firstName: string; lastName: string } | null;
  winnerAthlete?: { id: string; firstName: string; lastName: string } | null;
  winnerAthleteId?: string | null;
  status: FightStatus;
  winMethod?: WinMethod | null;
  matId?: string | null;
  mat?: { id: string; name: string } | null;
  orderInMat?: number | null;
  scheduledStartTime?: string | null;
  notes?: string | null;
  confirmedAt?: string | null;
}

export interface MatRow {
  id: string;
  eventId: string;
  name: string;
  label: string | null;
}

export interface NewsPostRow {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  published: boolean;
  eventId?: string | null;
  event?: { id: string; name: string; slug: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSubmissionRow {
  id: string;
  type: string;
  name: string;
  email: string;
  message: string | null;
  clubName: string | null;
  notes: string | null;
  status: SubmissionStatus;
  createdAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  clubId: string | null;
}

export interface TimerState {
  state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED';
  startedAt: string | null;
  pausedAt: string | null;
  elapsed: number;
  updatedAt?: string;
}
