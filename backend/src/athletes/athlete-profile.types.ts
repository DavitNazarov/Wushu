import type {
  AthleteSex,
  EventLifecycle,
  FightStatus,
  RegistrationStatus,
  WeighInDecision,
  WeighInStatus,
  WinMethod,
} from '@prisma/client';

// JSON contract types for the athlete profile pages. All Dates are serialized
// to ISO strings — these mirror the wire shape exactly so the frontend can
// pull them in unmodified via React Query.

// Slim coach summary shown in the profile header (one row per active coach
// in the athlete's club).
type AthleteProfileCoachRow = {
  id: string;
  displayName: string;
};

// Slim club summary shown in the profile header.
type AthleteProfileClubRow = {
  id: string;
  name: string;
  nameKa: string | null;
  city: string | null;
  country: string | null;
};

// One row in the "Events" section of the profile. The optional `?` fields
// (registrationStatus, weighInStatus, latestWeighIn*) only appear in the
// PRIVATE shape — public callers never get them.
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

// One row in the "Fights" section. `score` is the textual score-token
// (e.g. "5-2") extracted from fight.notes by extractScoreToken (see
// draw/brackets.helpers.ts) — the score is encoded into notes for legacy
// compatibility rather than being a first-class column.
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

// Career medal tally aggregated across every category the athlete has
// competed in (only published events on the public view). `gold`/`silver`/
// `bronze` are podium counts; `other` counts completed categories where the
// athlete competed but finished off the podium (4th+ / eliminated). `total`
// is the medal count (gold + silver + bronze).
export type AthleteMedalSummary = {
  gold: number;
  silver: number;
  bronze: number;
  other: number;
  total: number;
};

// Top-level response shape returned by AthleteProfileService.
// `dateOfBirth` and `coaches` are optional because the public flavor omits
// them — anyone with a published-event link to the athlete should not be
// able to see their DOB or the staff roster.
export type AthleteProfileResponse = {
  athlete: {
    id: string;
    firstName: string;
    firstNameKa: string | null;
    lastName: string;
    lastNameKa: string | null;
    fullName: string;
    sex: AthleteSex | null;
    dateOfBirth?: string | null;
    club: AthleteProfileClubRow | null;
    clubs: AthleteProfileClubRow[];
    coaches?: AthleteProfileCoachRow[];
  };
  registrations: AthleteProfileRegistrationRow[];
  fights: AthleteProfileFightRow[];
  medals: AthleteMedalSummary;
};
