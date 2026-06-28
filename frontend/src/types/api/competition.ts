// Live-competition types: draw readiness, brackets, schedule, results, mats and
// the fight timer.
import type {
  AthleteSex,
  BracketIssueSeverity,
  BracketPublicationStatus,
  BracketViewStatus,
  BronzePolicyCode,
  CompetitionFormat,
  DrawBracketStatus,
  DrawCategoryStatus,
  DrawIssueSeverity,
  DrawOverallStatus,
  EventLifecycle,
  FightStatus,
  PublishTimingPolicyCode,
  RegistrationStatus,
  WinMethod,
} from './enums';

interface DrawValidationIssue {
  code: string;
  severity: DrawIssueSeverity;
  count: number;
  sampleIds: string[];
}

export interface DrawCategoryOverviewRow {
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
  hasAgeGroupMove: boolean;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedByName: string | null;
  issues: DrawValidationIssue[];
}

export interface DrawAthletePoolRow {
  registrationId: string;
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  athleteCode: string;
  registrationStatus: RegistrationStatus;
  weighInStatus:
    | 'NOT_WEIGHED'
    | 'PASSED'
    | 'MOVED_UP'
    | 'FAILED'
    | 'OVERRIDE_APPROVED'
    | 'REWEIGH_ALLOWED'
    | 'DISQUALIFIED';
  weighInWeightKg: number | null;
  originalCategory: string | null;
  finalCategory: string | null;
  movedUp: boolean;
  crossesAgeGroup: boolean;
  overrideUsed: boolean;
  eligibilityState: 'ELIGIBLE' | 'EXCLUDED';
  exclusionReasonCode: string | null;
}

export interface DrawOverviewResponse {
  event: {
    id: string;
    name: string;
    lifecycle: EventLifecycle;
    publishTimingPolicyCode: PublishTimingPolicyCode;
    drawStatus: DrawOverallStatus;
    registrationLocked: boolean;
    weighInResultsPublic: boolean;
  };
  summary: {
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
  validation: {
    critical: DrawValidationIssue[];
    warnings: DrawValidationIssue[];
    healthy: boolean;
  };
  actions: {
    canGenerate: boolean;
    canRegenerate: boolean;
    generateBlockedReasonCode: string | null;
    regenerateBlockedReasonCode: string | null;
  };
  lastGeneration: {
    action: string | null;
    at: string | null;
    by: {
      id: string;
      displayName: string | null;
    } | null;
  };
  audit: {
    recent: Array<{
      id: string;
      action: string;
      createdAt: string;
      actorUserId: string | null;
      actorDisplayName: string | null;
      reason: string | null;
      override: boolean;
    }>;
  };
  categories: DrawCategoryOverviewRow[];
}

export interface DrawCategoryDetailsResponse {
  eventId: string;
  category: DrawCategoryOverviewRow;
  eligibleAthletes: DrawAthletePoolRow[];
  excludedAthletes: DrawAthletePoolRow[];
}

export interface BracketIssue {
  code: string;
  severity: BracketIssueSeverity;
}

export interface BracketsOverviewCategoryRow {
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
  updatedAt: string | null;
}

export interface BracketsOverviewResponse {
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
    at: string | null;
    by: {
      id: string;
      displayName: string | null;
    } | null;
  };
  audit: {
    recent: Array<{
      id: string;
      action: string;
      createdAt: string;
      actorUserId: string | null;
      actorDisplayName: string | null;
      reason: string | null;
      override: boolean;
    }>;
  };
  categories: BracketsOverviewCategoryRow[];
}

interface BracketParticipantView {
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  country: string | null;
  athleteCode: string;
  movedUp: boolean;
  overrideUsed: boolean;
  originalCategory: string | null;
  finalCategory: string | null;
}

export interface BracketParticipantSlotView {
  kind: 'ATHLETE' | 'WINNER_PLACEHOLDER' | 'BYE' | 'TBD';
  sourceBoutNo: number | null;
  athlete: BracketParticipantView | null;
}

interface BracketRoundMatchup {
  fightId: string;
  boutNo: number;
  round: number;
  status: FightStatus;
  winMethod: WinMethod | null;
  score: string | null;
  winnerAthleteId: string | null;
  isBye: boolean;
  orderInMat: number | null;
  scheduledStartTime: string | null;
  matName: string | null;
  participants: {
    red: BracketParticipantView | null;
    blue: BracketParticipantView | null;
  };
  slots: {
    red: BracketParticipantSlotView;
    blue: BracketParticipantSlotView;
  };
}

export interface BracketRoundColumn {
  round: number;
  label: string;
  matchups: BracketRoundMatchup[];
}

export interface BracketFightListRow {
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
  scheduledStartTime: string | null;
  matName: string | null;
  orderInMat: number | null;
}

export interface BracketCategoryDetailsResponse {
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
}

export interface PublicBracketsOverviewResponse {
  event: {
    id: string;
    name: string;
    slug: string;
    lifecycle: EventLifecycle;
    drawStatus: DrawOverallStatus;
    published: boolean;
  };
  summary: {
    categoriesWithBrackets: number;
    totalAthletesInBrackets: number;
    totalByes: number;
    movedUpAthletesCount: number;
  };
  lastUpdatedAt: string | null;
  categories: BracketsOverviewCategoryRow[];
}

export interface PublicBracketCategoryDetailsResponse {
  event: {
    id: string;
    name: string;
    slug: string;
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
}

export interface ScheduleSessionRow {
  id: string;
  eventId: string;
  name: string;
  nameKa: string | null;
  startTime: string;
  endTime: string;
  order: number;
}

export interface ScheduleFightRow {
  id: string;
  bracketRoundLabel: string;
  bracketFightNumber: number;
  scheduleOrder: number | null;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  redDisplayName: string;
  blueDisplayName: string;
  redDisplayNameKa?: string | null;
  blueDisplayNameKa?: string | null;
  redSourceScheduleOrder: number | null;
  blueSourceScheduleOrder: number | null;
  isPlayable: boolean;
  isScheduled: boolean;
  status: FightStatus;
  liveStatus?: 'PENDING' | 'UPCOMING' | 'RUNNING' | 'FINISHED';
  matId: string | null;
  matName: string | null;
  orderInMat: number | null;
  scheduledAt: string | null;
  sessionId: string | null;
  orderInSession: number | null;
  hasGapViolation?: boolean;
}

interface ResultsSummaryPlacementRow {
  rank: number;
  athleteId: string | null;
  athleteName: string | null;
  medal: 'GOLD' | 'SILVER' | 'BRONZE' | null;
}

interface ResultsSummaryStandingRow {
  rank: number;
  athleteId: string;
  athleteName: string;
  fights: number;
  wins: number;
  losses: number;
  pending: number;
  points: number;
  tieBreakWins: number;
}

interface ResultsSummaryCategoryRow {
  eventWeightCategoryId: string;
  categoryCode: string;
  categoryName: string;
  ageGroupName: string | null;
  competitionFormat: CompetitionFormat;
  athleteCount: number;
  totalFights: number;
  completedFights: number;
  completionState: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';
  needsReview: boolean;
  issues: Array<{ code: string; severity: 'CRITICAL' | 'WARNING' }>;
  placements: ResultsSummaryPlacementRow[];
  standings: ResultsSummaryStandingRow[] | null;
  medalists: {
    gold: ResultsSummaryPlacementRow | null;
    silver: ResultsSummaryPlacementRow | null;
    bronze: ResultsSummaryPlacementRow[];
  };
  finalFight: {
    id: string;
    round: number;
    boutNo: number;
    stageLabel: string;
    status: string;
    winnerAthleteId: string | null;
    winMethod: string | null;
    notes: string | null;
    redAthleteId: string | null;
    blueAthleteId: string | null;
    redAthleteName: string | null;
    blueAthleteName: string | null;
  } | null;
}

export interface ResultsSummaryResponse {
  policy: {
    bronzePolicyCode: BronzePolicyCode;
  };
  categories: ResultsSummaryCategoryRow[];
  medalTable: Array<{
    clubId: string | null;
    clubName: string;
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  }>;
}

export interface MatRow {
  id: string;
  eventId: string;
  name: string;
  label: string | null;
  order?: number;
}

export interface TimerState {
  state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED';
  phase: 'ROUND' | 'REST' | 'FINISHED';
  currentRound: number;
  phaseStartedAt: string | null;
  pausedAt: string | null;
  elapsed: number;
  phaseDurationSeconds: number;
  roundDurationSeconds: number;
  restDurationSeconds: number;
  redRoundWins: number;
  blueRoundWins: number;
  roundWinners: Array<'RED' | 'BLUE' | null>;
  updatedAt?: string;
}
