import type {
  AthleteSex,
  RegistrationStatus,
} from './api';

export type ClubAccountStatus =
  | 'ACTIVE'
  | 'DQ'
  | 'ARCHIVED'
  | 'INACTIVE';

export type ClubAccountRole =
  | 'admin'
  | 'coach'
  | 'athlete'
  | 'judge'
  | 'timekeeper';

export type ClubWeighInStatus =
  | 'NOT_WEIGHED'
  | 'PASSED'
  | 'MOVED_UP'
  | 'FAILED'
  | 'OVERRIDE_APPROVED'
  | 'REWEIGH_ALLOWED'
  | 'DISQUALIFIED';

export interface ClubDetailsCoachRow {
  id: string;
  displayName: string;
  email: string;
  status: ClubAccountStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClubDetailsRelatedAccountRow {
  id: string;
  displayName: string;
  email: string;
  role: ClubAccountRole;
  status: ClubAccountStatus;
  isActive: boolean;
  createdAt: string;
}

export interface ClubDetailsAthleteLatestRegistration {
  eventId: string;
  eventName: string;
  eventSlug: string;
  competitionStartDate: string;
  categoryCode: string;
  ageGroupName: string | null;
  finalWeightCategoryName: string | null;
  initialWeightCategoryName: string | null;
  status: RegistrationStatus;
  weighInStatus: ClubWeighInStatus;
}

export interface ClubDetailsAthleteRow {
  id: string;
  firstName: string;
  firstNameKa: string | null;
  lastName: string;
  lastNameKa: string | null;
  fullName: string;
  dateOfBirth: string;
  sex: AthleteSex | null;
  documentId: string;
  createdAt: string;
  registrationCount: number;
  activeRegistrationCount: number;
  categoryCodes: string[];
  latestRegistration: ClubDetailsAthleteLatestRegistration | null;
}

export interface ClubDetailsResponse {
  club: {
    id: string;
    name: string;
    nameKa: string | null;
    city: string | null;
    country: string | null;
    createdAt: string;
    updatedAt: string;
    contactEmails: string[];
  };
  overview: {
    totalCoaches: number;
    activeCoachAccounts: number;
    totalAthletes: number;
    activeAthletes: number;
    activeRegistrations: number;
    representedCategories: number;
    representedCategoryCodes: string[];
    maleAthletes: number;
    femaleAthletes: number;
    unspecifiedSexAthletes: number;
    relatedAccounts: number;
  };
  coaches: ClubDetailsCoachRow[];
  athletes: ClubDetailsAthleteRow[];
  relatedAccounts: ClubDetailsRelatedAccountRow[];
}
