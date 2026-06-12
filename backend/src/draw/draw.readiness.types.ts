import type {
  AthleteSex,
  EventLifecycle,
  PublishTimingPolicyCode,
  RegistrationStatus,
  WeighInStatus,
} from '@prisma/client';

// JSON contract types for /draw/overview and /draw/category. All ids stable;
// changing one breaks the frontend.

// CRITICAL blocks the draw; WARNING just shows a yellow banner.
type DrawIssueSeverity = 'CRITICAL' | 'WARNING';

// Top-level draw status pill at the header. See deriveDrawOverallStatus for
// the precise mapping.
export type DrawOverallStatus = 'NOT_GENERATED' | 'GENERATED' | 'PUBLISHED';

// Per-category "has the bracket been drawn?" — separate from the readinessStatus
// because a DRAWN category can still have issues (we just don't surface them).
type DrawBracketStatus = 'NOT_DRAWN' | 'DRAWN';

// Per-category readiness pill. See deriveCategoryStatus for the precedence.
// SOLO = exactly one eligible athlete (its own pill, not lumped under review).
export type DrawCategoryStatus =
  | 'READY'
  | 'BLOCKED'
  | 'DRAWN'
  | 'EMPTY'
  | 'SOLO'
  | 'NEEDS_REVIEW';

// One validation issue. `count` may exceed `sampleIds.length` because we cap
// the array at 5 entries — UI shows "+N more".
export type DrawValidationIssue = {
  code: string;
  severity: DrawIssueSeverity;
  count: number;
  sampleIds: string[];
};

// Top-level validation report. `healthy` is the convenience flag — true when
// both critical AND warnings are empty.
export type DrawValidationSummary = {
  critical: DrawValidationIssue[];
  warnings: DrawValidationIssue[];
  healthy: boolean;
};

// Tells the UI whether the two big draw buttons should be enabled. If not,
// the *BlockedReasonCode strings are i18n keys for the disabled tooltip.
export type DrawActionAvailability = {
  canGenerate: boolean;
  canRegenerate: boolean;
  generateBlockedReasonCode: string | null;
  regenerateBlockedReasonCode: string | null;
};

// Slim audit log projection for the "Recent activity" panel.
type DrawAuditSummaryItem = {
  id: string;
  action: string;
  createdAt: Date;
  actorUserId: string | null;
  actorDisplayName: string | null;
  reason: string | null;
  override: boolean;
};

// One row in the eligible/excluded athlete tables shown on the per-category
// detail view. `eligibilityState` is the column the UI sorts/filters on.
export type DrawAthletePoolRow = {
  registrationId: string;
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  athleteCode: string;
  registrationStatus: RegistrationStatus;
  weighInStatus: WeighInStatus;
  // Latest weigh-in attempt weight (kg) for this registration, null if never
  // weighed. Surfaced on the Weigh-In Results page.
  weighInWeightKg: number | null;
  originalCategory: string | null;
  finalCategory: string | null;
  movedUp: boolean;
  // movedUp AND the final category sits in a different age group than the
  // registered one. This (not plain movedUp) is what flags a category for review.
  crossesAgeGroup: boolean;
  overrideUsed: boolean;
  eligibilityState: 'ELIGIBLE' | 'EXCLUDED';
  exclusionReasonCode: string | null;
};

// One row in the per-category overview table. Carries pre-computed counters
// + an inline issues list so the UI can render without re-deriving anything.
type DrawCategoryOverviewRow = {
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
  // True when at least one eligible athlete crosses age groups — the move-up
  // signal that actually drives review (a same-age-group bump does not).
  hasAgeGroupMove: boolean;
  // Set by the "Mark as reviewed" workflow (Part B). `reviewed` is the EFFECTIVE
  // state — a stored review whose signature still matches the current pool. When
  // true, a SOLO/NEEDS_REVIEW category is treated as READY.
  reviewed: boolean;
  reviewedAt: Date | null;
  reviewedByName: string | null;
  issues: DrawValidationIssue[];
};

// Wire shape for GET /api/draw/category — overview row + the two athlete lists.
export type DrawCategoryDetailsResponse = {
  eventId: string;
  category: DrawCategoryOverviewRow;
  eligibleAthletes: DrawAthletePoolRow[];
  excludedAthletes: DrawAthletePoolRow[];
};

// Header summary numbers for the readiness page cards.
type DrawOverviewSummary = {
  totalCategories: number;
  readyCategoriesCount: number;
  blockedCategoriesCount: number;
  drawnCategoriesCount: number;
  emptyCategoriesCount: number;
  needsReviewCategoriesCount: number;
  soloCategoriesCount: number;
  eligibleAthletesCount: number;
  movedUpAthletesCount: number;
  outstandingIssuesCount: number;
  criticalIssuesCount: number;
  warningIssuesCount: number;
};

// Full wire shape for GET /api/draw/overview. The richest single payload in
// the draw module — the UI builds the entire pre-draw page from this object.
export type DrawOverviewResponse = {
  event: {
    id: string;
    name: string;
    lifecycle: EventLifecycle;
    publishTimingPolicyCode: PublishTimingPolicyCode;
    drawStatus: DrawOverallStatus;
    registrationLocked: boolean;
    weighInResultsPublic: boolean;
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

// Internal: row carrying the full athlete lists inline so per-category lookups
// don't need a second DB pass. NOT serialized to the client.
export type DrawCategoryComputedRow = DrawCategoryOverviewRow & {
  eligibleAthletes: DrawAthletePoolRow[];
  excludedAthletes: DrawAthletePoolRow[];
};

// Internal: full result returned by computeDrawReadiness — both the
// client-shaped overview and the per-category Map for cheap lookups.
export type DrawComputedOverview = {
  overview: DrawOverviewResponse;
  categoriesById: Map<string, DrawCategoryComputedRow>;
};
