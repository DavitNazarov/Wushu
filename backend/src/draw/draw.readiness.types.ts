import type {
  AthleteSex,
  EventLifecycle,
  PublishTimingPolicyCode,
  RegistrationStatus,
  WeighInStatus,
} from '@prisma/client';

export type DrawIssueSeverity = 'CRITICAL' | 'WARNING';

export type DrawOverallStatus = 'NOT_GENERATED' | 'GENERATED' | 'PUBLISHED';

export type DrawBracketStatus = 'NOT_DRAWN' | 'DRAWN';

export type DrawCategoryStatus =
  | 'READY'
  | 'BLOCKED'
  | 'DRAWN'
  | 'EMPTY'
  | 'NEEDS_REVIEW';

export type DrawValidationIssue = {
  code: string;
  severity: DrawIssueSeverity;
  count: number;
  sampleIds: string[];
};

export type DrawValidationSummary = {
  critical: DrawValidationIssue[];
  warnings: DrawValidationIssue[];
  healthy: boolean;
};

export type DrawActionAvailability = {
  canGenerate: boolean;
  canRegenerate: boolean;
  generateBlockedReasonCode: string | null;
  regenerateBlockedReasonCode: string | null;
};

export type DrawAuditSummaryItem = {
  id: string;
  action: string;
  createdAt: Date;
  actorUserId: string | null;
  actorDisplayName: string | null;
  reason: string | null;
  override: boolean;
};

export type DrawAthletePoolRow = {
  registrationId: string;
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  athleteCode: string;
  registrationStatus: RegistrationStatus;
  weighInStatus: WeighInStatus;
  originalCategory: string | null;
  finalCategory: string | null;
  movedUp: boolean;
  overrideUsed: boolean;
  eligibilityState: 'ELIGIBLE' | 'EXCLUDED';
  exclusionReasonCode: string | null;
};

export type DrawCategoryOverviewRow = {
  id: string;
  ageGroupCode: string;
  ageGroupName: string;
  division: AthleteSex | null;
  categoryName: string;
  sortOrder: number;
  bracketStatus: DrawBracketStatus;
  readinessStatus: DrawCategoryStatus;
  eligibleAthletesCount: number;
  excludedAthletesCount: number;
  criticalIssueCount: number;
  warningIssueCount: number;
  issueCount: number;
  hasMovedUpAthletes: boolean;
  hasOverrideAthletes: boolean;
  issues: DrawValidationIssue[];
};

export type DrawCategoryDetailsResponse = {
  eventId: string;
  category: DrawCategoryOverviewRow;
  eligibleAthletes: DrawAthletePoolRow[];
  excludedAthletes: DrawAthletePoolRow[];
};

export type DrawOverviewSummary = {
  totalCategories: number;
  readyCategoriesCount: number;
  blockedCategoriesCount: number;
  drawnCategoriesCount: number;
  emptyCategoriesCount: number;
  needsReviewCategoriesCount: number;
  eligibleAthletesCount: number;
  movedUpAthletesCount: number;
  outstandingIssuesCount: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
};

export type DrawOverviewResponse = {
  event: {
    id: string;
    name: string;
    lifecycle: EventLifecycle;
    publishTimingPolicyCode: PublishTimingPolicyCode;
    drawStatus: DrawOverallStatus;
    registrationLocked: boolean;
  };
  summary: DrawOverviewSummary;
  validation: DrawValidationSummary;
  actions: DrawActionAvailability;
  lastGeneration: {
    action: string | null;
    at: Date | null;
    by: {
      id: string;
      displayName: string | null;
    } | null;
  };
  audit: {
    recent: DrawAuditSummaryItem[];
  };
  categories: DrawCategoryOverviewRow[];
};

export type DrawCategoryComputedRow = DrawCategoryOverviewRow & {
  eligibleAthletes: DrawAthletePoolRow[];
  excludedAthletes: DrawAthletePoolRow[];
};

export type DrawComputedOverview = {
  overview: DrawOverviewResponse;
  categoriesById: Map<string, DrawCategoryComputedRow>;
};
