import type {
  AthleteSex,
  EventLifecycle,
  FightStatus,
  PublishTimingPolicyCode,
  WinMethod,
} from '@prisma/client';
import type { DrawAthletePoolRow, DrawOverallStatus } from './draw.readiness.types';
import type { CompetitionFormat } from './competition-format';

export type BracketViewStatus =
  | 'NOT_GENERATED'
  | 'GENERATED_DRAFT'
  | 'PUBLISHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NEEDS_REVIEW'
  | 'EMPTY';

export type BracketPublicationStatus = 'DRAFT' | 'PUBLISHED';

export type BracketIssueSeverity = 'CRITICAL' | 'WARNING';

export type BracketIssue = {
  code: string;
  severity: BracketIssueSeverity;
};

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
    canPublish: boolean;
    canUnpublish: boolean;
    canExport: boolean;
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

export type BracketRoundMatchup = {
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
};

export type BracketRoundColumn = {
  round: number;
  label: string;
  matchups: BracketRoundMatchup[];
};

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
  scheduledStartTime: Date | null;
  matName: string | null;
  orderInMat: number | null;
};

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
