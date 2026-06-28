// Admin & profile types: athlete public profile, news, contact inbox, users.
import type {
  AthleteSex,
  EventLifecycle,
  FightStatus,
  RegistrationStatus,
  SubmissionStatus,
  WeighInDecision,
  WinMethod,
} from './enums';

interface AthleteProfileCoachRow {
  id: string;
  displayName: string;
}

interface AthleteProfileClubRow {
  id: string;
  name: string;
  nameKa: string | null;
  city: string | null;
  country: string | null;
}

export interface AthleteProfileRegistrationRow {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventLifecycle: EventLifecycle;
  eventPublished: boolean;
  competitionStartDate: string;
  competitionEndDate: string;
  categoryCode: string;
  ageGroupName: string | null;
  division: AthleteSex | null;
  registrationStatus?: RegistrationStatus;
  weighInStatus?:
    | 'NOT_WEIGHED'
    | 'PASSED'
    | 'MOVED_UP'
    | 'FAILED'
    | 'OVERRIDE_APPROVED'
    | 'REWEIGH_ALLOWED'
    | 'DISQUALIFIED';
  initialWeightCategoryName: string | null;
  finalWeightCategoryName: string | null;
  movedUp: boolean;
  latestWeighInDecision?: WeighInDecision | null;
  latestWeighInAt?: string | null;
}

export interface AthleteProfileFightRow {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventLifecycle: EventLifecycle;
  categoryCode: string;
  round: number;
  boutNo: number;
  status: FightStatus;
  winMethod: WinMethod | null;
  score: string | null;
  scheduledStartTime: string | null;
  matName: string | null;
  athleteCorner: 'RED' | 'BLUE';
  opponentAthleteId: string | null;
  opponentName: string | null;
  winnerAthleteId: string | null;
}

export interface AthleteMedalSummary {
  gold: number;
  silver: number;
  bronze: number;
  other: number;
  total: number;
}

export interface AthleteProfileResponse {
  athlete: {
    id: string;
    firstName: string;
    firstNameKa: string | null;
    lastName: string;
    lastNameKa: string | null;
    fullName: string;
    sex: AthleteSex | null;
    dateOfBirth?: string | null;
    documentId?: string | null;
    club: AthleteProfileClubRow | null;
    clubs: AthleteProfileClubRow[];
    coaches?: AthleteProfileCoachRow[];
  };
  registrations: AthleteProfileRegistrationRow[];
  fights: AthleteProfileFightRow[];
  medals: AthleteMedalSummary;
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
  status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clubId: string | null;
  nationality: string | null;
  club: { id: string; name: string } | null;
}

export interface UserDetailRow {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'coach';
  status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE';
  isActive: boolean;
  clubId: string | null;
  nationality: string | null;
  club: { id: string; name: string } | null;
  disciplinary: {
    isActive: boolean;
    reason: string | null;
    note: string | null;
    startAt: string | null;
    endAt: string | null;
  };
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface UserCapabilityRow {
  code: string;
  granted: boolean;
  isDefault: boolean;
  isCustom: boolean;
}
