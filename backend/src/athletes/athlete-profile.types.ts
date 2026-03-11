import type {
  AthleteSex,
  EventLifecycle,
  FightStatus,
  RegistrationStatus,
  WeighInDecision,
  WeighInStatus,
  WinMethod,
} from '@prisma/client';

export type AthleteProfileCoachRow = {
  id: string;
  displayName: string;
};

export type AthleteProfileClubRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export type AthleteProfileRegistrationRow = {
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
  weighInStatus?: WeighInStatus;
  initialWeightCategoryName: string | null;
  finalWeightCategoryName: string | null;
  movedUp: boolean;
  latestWeighInDecision?: WeighInDecision | null;
  latestWeighInAt?: string | null;
};

export type AthleteProfileFightRow = {
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
};

export type AthleteProfileResponse = {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    sex: AthleteSex | null;
    dateOfBirth?: string | null;
    club: AthleteProfileClubRow | null;
    coaches?: AthleteProfileCoachRow[];
  };
  registrations: AthleteProfileRegistrationRow[];
  fights: AthleteProfileFightRow[];
};
