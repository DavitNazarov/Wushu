// Configuration & registry types: events, category templates/options, and the
// people/place registry (clubs, federations, countries, cities, athletes,
// registrations).
import type {
  AthleteSex,
  BronzePolicyCode,
  CategoryTemplateStatus,
  CategoryTemplateType,
  EventLifecycle,
  PublishTimingPolicyCode,
  RegistrationStatus,
  RegistrationWindowStatus,
  RestPolicyCode,
  WeighInPolicyCode,
} from './enums';

interface EventDates {
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
  nameKa?: string | null;
  slug: string;
  location: string;
  /** Optional per-athlete entry fee (whole GEL). null/omitted = no fee. */
  entryFee?: number | null;
  timezone: string;
  autoAdvanceStage?: boolean;
  accessType: 'OPEN' | 'CLOSED';
  categoryTemplateId?: string;
  dates: EventDates;
  registrationWindow?: {
    opensAt: string; // YYYY-MM-DD
    closesAt?: string; // YYYY-MM-DD
  };
  policies?: {
    weighInPolicyCode?: WeighInPolicyCode;
    bronzePolicyCode?: BronzePolicyCode;
    restPolicyCode?: RestPolicyCode;
    minRestMinutes?: number;
    publishTimingPolicyCode?: PublishTimingPolicyCode;
    reweighWindowMinutes?: number;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface EventRow {
  id: string;
  name: string;
  nameKa: string | null;
  slug: string;
  lifecycle: EventLifecycle;
  location: string | null;
  entryFee: number | null;
  timezone: string;
  published: boolean;
  autoAdvanceStage: boolean;
  accessType: 'OPEN' | 'CLOSED';
  categoryTemplateId: string | null;
  weighInPolicyCode: WeighInPolicyCode;
  bronzePolicyCode: BronzePolicyCode;
  restPolicyCode: RestPolicyCode;
  minRestMinutes: number;
  publishTimingPolicyCode: PublishTimingPolicyCode;
  reweighWindowMinutes: number;
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

export interface CategoryTemplateRow {
  id: string;
  name: string;
  version: number;
  status: CategoryTemplateStatus;
  type?: CategoryTemplateType;
  sourceLabel?: string | null;
  discipline?: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
  ageGroupCount?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  deleteBlockedReason?: string | null;
}

interface CategoryTemplateCategoryRow {
  id: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
}

export interface CategoryTemplateGroupRow {
  id: string;
  code: string;
  name: string;
  nameKa: string | null;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  weightCategories: CategoryTemplateCategoryRow[];
}

interface CategoryTemplateUsageEventRow {
  id: string;
  name: string;
  nameKa?: string | null;
  lifecycle: string;
  competitionStartDate: string;
}

export interface CategoryTemplateDetailRow extends CategoryTemplateRow {
  type: CategoryTemplateType;
  organisationId: string | null;
  selectedCategoryOptionIds: string[];
  counts: {
    ageGroups: number;
    genders: number;
    weightCategories: number;
    roundsConfigured: number;
  };
  ageGroups: CategoryTemplateGroupRow[];
  usage: {
    snapshotCount: number;
    eventAgeGroupCount: number;
    eventWeightCategoryCount: number;
    recentEvents: CategoryTemplateUsageEventRow[];
  };
  permissions: {
    canEdit: boolean;
    canEditStructure: boolean;
    canDelete: boolean;
    reasonCodes: string[];
  };
}

interface CategoryOptionRow {
  id: string;
  code: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
}

export interface CategoryOptionGroupRow {
  id: string;
  code: string;
  name: string;
  nameKa: string | null;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  isActive: boolean;
  options: CategoryOptionRow[];
}

/** Payload for creating/updating a category group (weight-category library). */
interface WeightDivisionInput {
  /** Present when editing an existing division; omitted for new rows. */
  id?: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
}

export interface CategoryOptionGroupInput {
  name: string;
  nameKa: string | null;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  isActive: boolean;
  weights: WeightDivisionInput[];
}

export interface EventWeightCategoryRow {
  id: string;
  categoryTemplateCategoryId: string;
  name: string;
  minWeightKgExcl: number | null;
  maxWeightKgIncl: number | null;
  sortOrder: number;
}

export interface EventAgeGroupRow {
  id: string;
  categoryTemplateGroupId: string;
  code: string;
  name: string;
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  weightCategories: EventWeightCategoryRow[];
}

export interface EventCategoriesResponse {
  eventId: string;
  categoryTemplateId: string | null;
  ageGroups: EventAgeGroupRow[];
}

export type CategorySelection = {
  categoryTemplateId: string;
  ageGroups: Array<{ categoryTemplateGroupId: string; weightCategoryIds: string[] }>;
};

export interface ClubRow {
  id: string;
  name: string;
  nameKa: string | null;
  isOfficial: boolean;
  city: string | null;
  // `country` is the country NAME (derived from the club's Country relation).
  country: string | null;
  // Present on the /api/clubs list (city/country are required on a club);
  // omitted on the lighter club summary embedded in athlete rows.
  cityId?: string;
  cityName?: string;
  cityNameKa?: string | null;
  countryId?: string;
  countryNameKa?: string | null;
  // Optional parent federation (a club may sit directly under a city instead).
  federationId?: string | null;
  federationName?: string | null;
  federationNameKa?: string | null;
}

// GET /api/federations — a federation within a city, with its club count.
export interface FederationRow {
  id: string;
  cityId: string;
  countryId: string;
  name: string;
  nameKa: string | null;
  isOfficial: boolean;
  cityName: string;
  cityNameKa: string | null;
  countryName: string;
  countryNameKa: string | null;
  clubCount: number;
}

// Top-level country row for the admin countries table.
export interface CountryRow {
  id: string;
  name: string;
  nameKa: string | null;
  code: string | null;
  cityCount: number;
  clubCount: number;
}

// A city as shown inside a country's detail page.
export interface CountryRegionRow {
  id: string;
  name: string;
  nameKa: string | null;
  clubCount: number;
}

// GET /api/countries/:id — a country plus its cities.
export interface CountryDetail {
  id: string;
  name: string;
  nameKa: string | null;
  code: string | null;
  cities: CountryRegionRow[];
}

// GET /api/cities — a city with its parent country name + club count.
export interface CityRow {
  id: string;
  countryId: string;
  name: string;
  nameKa: string | null;
  countryName: string;
  countryNameKa: string | null;
  clubCount: number;
}

export interface AthleteRow {
  id: string;
  firstName: string;
  firstNameKa: string | null;
  lastName: string;
  lastNameKa: string | null;
  dateOfBirth: string | null;
  sex: AthleteSex | null;
  documentId: string;
  clubId: string | null;
  clubIds?: string[];
  cityId?: string | null;
  countryId?: string | null;
  club?: ClubRow | null;
  clubs?: ClubRow[];
  duplicateCount?: number;
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
  athlete?: { id: string; firstName: string; firstNameKa?: string | null; lastName: string; lastNameKa?: string | null; dateOfBirth: string };
  club?: ClubRow | null;
}

export interface RegistrationBulkStatusResponse {
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  results: Array<{
    registrationId: string;
    outcome: 'UPDATED' | 'SKIPPED' | 'FAILED';
    errorCode?: string;
  }>;
}
