import type {
  AthleteSex,
  RegistrationStatus,
  UserRole,
  WeighInStatus,
} from '@prisma/client';
import type { UserAccountStatus } from '../users/users.state';

export type ClubDetailsCoachRow = {
  id: string;
  displayName: string;
  email: string;
  status: UserAccountStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClubDetailsRelatedAccountRow = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  isActive: boolean;
  createdAt: string;
};

export type ClubDetailsAthleteLatestRegistration = {
  eventId: string;
  eventName: string;
  eventSlug: string;
  competitionStartDate: string;
  categoryCode: string;
  ageGroupName: string | null;
  finalWeightCategoryName: string | null;
  initialWeightCategoryName: string | null;
  status: RegistrationStatus;
  weighInStatus: WeighInStatus;
};

export type ClubDetailsAthleteRow = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  sex: AthleteSex | null;
  documentId: string | null;
  createdAt: string;
  registrationCount: number;
  activeRegistrationCount: number;
  categoryCodes: string[];
  latestRegistration: ClubDetailsAthleteLatestRegistration | null;
};

export type ClubDetailsResponse = {
  club: {
    id: string;
    name: string;
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
};
