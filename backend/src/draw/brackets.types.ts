import type {
  AthleteSex,
  EventLifecycle,
  FightStatus,
  PublishTimingPolicyCode,
  WinMethod,
} from '@prisma/client';
import type {
  DrawAthletePoolRow,
  DrawOverallStatus,
} from './draw.readiness.types';
import type { CompetitionFormat } from './competition-format';

// JSON contract types for /api/brackets/overview and /api/brackets/category.
// Mirrored on the frontend — keep the codes stable.

// Per-bracket pill values. See deriveBracketCategoryStatus for the rules.
export type BracketViewStatus =
  | 'NOT_GENERATED'
  | 'GENERATED_DRAFT'
  | 'PUBLISHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NEEDS_REVIEW'
  | 'EMPTY';

// Two-state publish flag for each bracket row.
export type BracketPublicationStatus = 'DRAFT' | 'PUBLISHED';

// CRITICAL blocks publication; WARNING is a yellow-banner-only.
type BracketIssueSeverity = 'CRITICAL' | 'WARNING';

// One inline issue surfaced under a bracket row. Codes are i18n keys.
export type BracketIssue = {
  code: string;
  severity: BracketIssueSeverity;
};

// One row in the brackets overview table — slim summary per category.
export type BracketsOverviewCategoryRow = {
  id: string;
  ageGroupCode: string;
  ageGroupName: string;
  division: AthleteSex | null;
  categoryName: string;
  sortOrder: number;
  competitionFormat: CompetitionFormat;
  status: BracketViewStatus;
  publicationStatus: BracketPublicationStatus;
  athleteCount: number;
  eligibleAthletesCount: number;
  fightCount: number;
  byesCount: number;
  movedUpAthletesCount: number;
  issueCount: number;
  issues: BracketIssue[];
  updatedAt: Date | null;
};

// Top-level shape returned from GET /api/brackets/overview. Powers the admin
// "Brackets" page after a draw has been run. Carries event header, summary
// counters, action availability, last-update metadata, recent audit slice,
// and the full per-bracket list.
export type BracketsOverviewResponse = {
  event: {
    id: string;
    name: string;
    lifecycle: EventLifecycle;
    drawStatus: DrawOverallStatus;
    publishTimingPolicyCode: PublishTimingPolicyCode;
    published: boolean;
  };
  summary: {
    totalCategories: number;
    categoriesWithBrackets: number;
    publishedCategoriesCount: number;
    unpublishedCategoriesCount: number;
    totalAthletesInBrackets: number;
    totalByes: number;
    movedUpAthletesCount: number;
    needsReviewCategoriesCount: number;
  };
  actions: {
    canGenerate: boolean;
    canPublish: boolean;
    canUnpublish: boolean;
    canExport: boolean;
    generateBlockedReasonCode: string | null;
    publishBlockedReasonCode: string | null;
    unpublishBlockedReasonCode: string | null;
  };
  lastUpdated: {
    at: Date | null;
    by: {
      id: string;
      displayName: string | null;
    } | null;
  };
  audit: {
    recent: Array<{
      id: string;
      action: string;
      createdAt: Date;
      actorUserId: string | null;
      actorDisplayName: string | null;
      reason: string | null;
      override: boolean;
    }>;
  };
  categories: BracketsOverviewCategoryRow[];
};

// Slim athlete projection used inside a bracket cell. Carries the "moved up"
// + "overrideUsed" flags so the UI can render badges without joining back.
export type BracketParticipantView = {
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  country: string | null;
  athleteCode: string;
  movedUp: boolean;
  overrideUsed: boolean;
  originalCategory: string | null;
  finalCategory: string | null;
};

// Per-slot kind in a bracket cell:
//   ATHLETE             — real athlete attached
//   WINNER_PLACEHOLDER  — "Winner of bout N" (upstream undecided)
//   BYE                 — automatic walkover slot
//   TBD                 — unknown (rare; should be replaced before publish)
// sourceBoutNo is set for WINNER_PLACEHOLDER so the UI can render "W of #5".
export type BracketParticipantSlotView = {
  kind: 'ATHLETE' | 'WINNER_PLACEHOLDER' | 'BYE' | 'TBD';
  sourceBoutNo: number | null;
  athlete: BracketParticipantView | null;
};

// One fight in a round column of the bracket grid view.
type BracketRoundMatchup = {
  fightId: string;
  boutNo: number;
  round: number;
  status: FightStatus;
  winMethod: WinMethod | null;
  score: string | null;
  winnerAthleteId: string | null;
  isBye: boolean;
  orderInMat: number | null;
  scheduledStartTime: Date | null;
  matName: string | null;
  participants: {
    red: BracketParticipantView | null;
    blue: BracketParticipantView | null;
  };
  slots: {
    red: BracketParticipantSlotView;
    blue: BracketParticipantSlotView;
  };
};

// One column in the bracket grid view (a round). `label` is a localized
// stage tag like FINAL / SEMIFINAL / ROUND_4 derived from roundStageLabel.
export type BracketRoundColumn = {
  round: number;
  label: string;
  matchups: BracketRoundMatchup[];
};

// Flat-table representation of the same fights — used by the "list view"
// tab on the bracket detail page. Same data, different shape.
export type BracketFightListRow = {
  id: string;
  boutNo: number;
  round: number;
  stageLabel: string;
  status: FightStatus;
  winMethod: WinMethod | null;
  score: string | null;
  winnerAthleteId: string | null;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  redAthleteName: string | null;
  blueAthleteName: string | null;
  redSlot: BracketParticipantSlotView;
  blueSlot: BracketParticipantSlotView;
  scheduledStartTime: Date | null;
  matName: string | null;
  orderInMat: number | null;
};

// Top-level shape for GET /api/brackets/category — full per-bracket detail.
// Returns event header, category overview row, summary counters, both the
// grid-view rounds AND the flat fight list, eligible+excluded athlete pools,
// and per-bracket action availability (publish/unpublish).
export type BracketCategoryDetailsResponse = {
  event: {
    id: string;
    name: string;
    lifecycle: EventLifecycle;
    drawStatus: DrawOverallStatus;
    published: boolean;
  };
  category: BracketsOverviewCategoryRow;
  summary: {
    totalAthletes: number;
    totalFights: number;
    completedFights: number;
    inProgressFights: number;
    byesCount: number;
    semifinalCount: number;
    finalCount: number;
    movedUpAthletesCount: number;
    bronzePolicy: 'TWO_BRONZES';
  };
  rounds: BracketRoundColumn[];
  fights: BracketFightListRow[];
  athletes: {
    eligible: DrawAthletePoolRow[];
    excluded: DrawAthletePoolRow[];
  };
  actions: {
    canPublish: boolean;
    canUnpublish: boolean;
  };
};
