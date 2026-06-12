import type {
  AthleteSex,
  RegistrationStatus,
  UserRole,
  WeighInStatus,
} from '@prisma/client';
import type { UserAccountStatus } from '../users/users.state';

// JSON contract types for the admin club detail page. All dates are ISO
// strings; the service is responsible for converting Prisma's Date instances.

// One row in the "Coaches" panel of the club detail page.
export type ClubDetailsCoachRow = {
  id: string;
  displayName: string;
  email: string;
  status: UserAccountStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// Row in the "Other accounts" panel — admins/judges/timekeepers who happen
// to have this clubId set (rare, mostly historical). Coaches go in their own
// `coaches` panel above.
export type ClubDetailsRelatedAccountRow = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  isActive: boolean;
  createdAt: string;
};

// "Most recent registration" summary attached to each athlete row — used
// by the UI to show what the athlete is most-recently associated with.
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

// One row in the athletes table on the club detail page. Carries pre-computed
// activity stats (registrationCount, active count, distinct categoryCodes)
// so the UI can render badges without doing its own aggregation.
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

// Top-level shape returned from GET /api/clubs/:id. `overview` carries the
// numbers shown in the header cards; the three arrays drive the page tabs.
export type ClubDetailsResponse = {
  club: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    countryNameKa: string | null;
    regionName: string | null;
    regionNameKa: string | null;
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
