export type EventLifecycle =
  | 'REG_OPEN'
  | 'LOCKED'
  | 'WEIGHIN'
  | 'WEIGH_IN_COMPLETED'
  | 'DRAWN'
  | 'PUBLISHED'
  | 'LIVE'
  | 'COMPLETED';

export type RegistrationWindowStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

export type CategoryTemplateStatus = 'DRAFT' | 'ACTIVE';
export type CategoryTemplateType = 'SYSTEM' | 'CUSTOM' | 'OFFICIAL';
export type RegistrationStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type WeighInDecision =
  | 'PASS'
  | 'MOVED_UP'
  | 'REWEIGH'
  | 'FAIL'
  | 'ONE_HOUR'
  | 'DISQUALIFIED';
export type WeighInPolicyCode =
  | 'IWUF_STRICT_ONE_HOUR'
  | 'MOVE_UP_AFTER_FAILED_REWEIGH'
  | 'DIRECT_MOVE_UP'
  | 'MANUAL_ADMIN_DECISION';
export type BronzePolicyCode = 'TWO_BRONZES';
export type RestPolicyCode = 'MIN_15_MINUTES';
export type PublishTimingPolicyCode =
  | 'IMMEDIATE_AFTER_DRAW'
  | 'MANUAL_PUBLISH_LATER'
  | 'COMPETITION_DAY_ONLY';
export type FightStatus = 'QUEUED' | 'ON_DECK' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETE' | 'CONFIRMED';
export type WinMethod = 'POINTS' | 'KO' | 'DQ' | 'WO';
export type AthleteSex = 'MALE' | 'FEMALE';
export type SubmissionStatus = 'NEW' | 'HANDLED';

export interface EventDates {
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
  slug: string;
  location: string;
  timezone: string;
  autoAdvanceStage?: boolean;
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
  slug: string;
  lifecycle: EventLifecycle;
  location: string | null;
  timezone: string;
  published: boolean;
  autoAdvanceStage: boolean;
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

export interface CategoryTemplateCategoryRow {
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
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  weightCategories: CategoryTemplateCategoryRow[];
}

export interface CategoryTemplateUsageEventRow {
  id: string;
  name: string;
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

export interface CategoryOptionRow {
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
  sex: AthleteSex | null;
  minAge: number | null;
  maxAge: number | null;
  roundDurationSeconds: number;
  sortOrder: number;
  options: CategoryOptionRow[];
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
  city: string | null;
  country: string | null;
}

export interface AthleteRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  sex: AthleteSex | null;
  documentId: string | null;
  clubId: string | null;
  club?: ClubRow | null;
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
  athlete?: { id: string; firstName: string; lastName: string; dateOfBirth: string };
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

export interface WeighInResult {
  id: string;
  registrationId: string;
  weight: number;
  decision: WeighInDecision;
  reason: string | null;
  override: boolean;
  createdAt: string;
}

export interface BracketRow {
  id: string;
  eventId: string;
  categoryCode: string;
  seed?: number | null;
  fights?: FightRow[];
}

export type DrawIssueSeverity = 'CRITICAL' | 'WARNING';
export type DrawOverallStatus = 'NOT_GENERATED' | 'GENERATED' | 'PUBLISHED';
export type DrawBracketStatus = 'NOT_DRAWN' | 'DRAWN';
export type DrawCategoryStatus =
  | 'READY'
  | 'BLOCKED'
  | 'DRAWN'
  | 'EMPTY'
  | 'NEEDS_REVIEW';

export interface DrawValidationIssue {
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
  hasOverrideAthletes: boolean;
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
  originalCategory: string | null;
  finalCategory: string | null;
  movedUp: boolean;
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
  };
  summary: {
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

export type BracketViewStatus =
  | 'NOT_GENERATED'
  | 'GENERATED_DRAFT'
  | 'PUBLISHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NEEDS_REVIEW'
  | 'EMPTY';

export type BracketPublicationStatus = 'DRAFT' | 'PUBLISHED';
export type CompetitionFormat =
  | 'DIRECT_FINAL'
  | 'ROUND_ROBIN'
  | 'SINGLE_ELIMINATION';

export type BracketIssueSeverity = 'CRITICAL' | 'WARNING';

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
    canPublish: boolean;
    canUnpublish: boolean;
    canExport: boolean;
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

export interface BracketParticipantView {
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

export interface BracketRoundMatchup {
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

export interface FightRow {
  id: string;
  bracketId?: string | null;
  categoryCode?: string;
  eventWeightCategoryId?: string | null;
  roundDurationSeconds?: number | null;
  round: number;
  boutNo: number;
  redAthleteId?: string | null;
  blueAthleteId?: string | null;
  redAthlete?: { id: string; firstName: string; lastName: string } | null;
  blueAthlete?: { id: string; firstName: string; lastName: string } | null;
  winnerAthlete?: { id: string; firstName: string; lastName: string } | null;
  winnerAthleteId?: string | null;
  status: FightStatus;
  winMethod?: WinMethod | null;
  matId?: string | null;
  mat?: { id: string; name: string } | null;
  orderInMat?: number | null;
  scheduledStartTime?: string | null;
  notes?: string | null;
  confirmedAt?: string | null;
}

export interface ScheduleSessionRow {
  id: string;
  eventId: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
}

export interface ScheduleFightRow {
  id: string;
  bracketRoundLabel: string;
  bracketFightNumber: number;
  scheduleOrder: number | null;
  redDisplayName: string;
  blueDisplayName: string;
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
}

export interface AutoScheduleConflict {
  fightId: string;
  scheduledOrder: number;
  athleteIds: string[];
  violatedAthleteIds: string[];
  previousFightIds: string[];
  requiredFightGap: number;
  actualFightGap: number;
  missingFightCount: number;
}

export interface AutoScheduleDiagnostics {
  minFightGap: number;
  fullySatisfied: boolean;
  conflictCount: number;
  conflicts: AutoScheduleConflict[];
}

export interface AutoScheduleResponse {
  updates: Array<{
    id: string;
    matId: string;
    orderInMat: number;
    scheduledStartTime: string;
  }>;
  diagnostics: AutoScheduleDiagnostics;
}

export interface LiveBoardParticipantView {
  athleteId: string | null;
  name: string;
  kind: 'ATHLETE' | 'WINNER_PLACEHOLDER' | 'BYE' | 'TBD';
  sourceBoutNo: number | null;
}

export interface LiveBoardFightRow {
  id: string;
  round: number;
  boutNo: number;
  stageLabel: string;
  bracketRoundLabel?: string;
  scheduleOrder?: number | null;
  redSourceScheduleOrder?: number | null;
  blueSourceScheduleOrder?: number | null;
  status: FightStatus;
  isPlayable?: boolean;
  winnerAthleteId: string | null;
  winMethod: WinMethod | null;
  notes: string | null;
  red: LiveBoardParticipantView;
  blue: LiveBoardParticipantView;
  matId?: string | null;
  matName?: string | null;
  orderInMat?: number | null;
  scheduledAt?: string | null;
  timerState: TimerState | null;
}

export interface LiveCategoryBoardCategoryRow {
  eventWeightCategoryId: string;
  categoryCode: string;
  categoryName: string;
  ageGroupName: string | null;
  competitionFormat: CompetitionFormat;
  athleteCount: number;
  totalFights: number;
  completedFights: number;
  completionState: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';
  currentFightStatus: FightStatus | null;
  needsReview: boolean;
  issues: Array<{ code: string; severity: 'CRITICAL' | 'WARNING' }>;
}

export interface LiveCategoryBoardResponse {
  eventId: string;
  categories: LiveCategoryBoardCategoryRow[];
  selectedCategoryId: string | null;
  board: (LiveCategoryBoardCategoryRow & {
    currentFight: LiveBoardFightRow | null;
    onDeck?: LiveBoardFightRow | null;
    queue: LiveBoardFightRow[];
    completed: LiveBoardFightRow[];
  }) | null;
}

export interface ResultsSummaryPlacementRow {
  rank: number;
  athleteId: string | null;
  athleteName: string | null;
  medal: 'GOLD' | 'SILVER' | 'BRONZE' | null;
}

export interface ResultsSummaryStandingRow {
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

export interface ResultsSummaryCategoryRow {
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

export interface AthleteProfileCoachRow {
  id: string;
  displayName: string;
}

export interface AthleteProfileClubRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
}

export interface AthleteProfileRegistrationRow {
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
  weighInStatus?:
    | 'NOT_WEIGHED'
    | 'PASSED'
    | 'MOVED_UP'
    | 'FAILED'
    | 'OVERRIDE_APPROVED'
    | 'REWEIGH_ALLOWED'
    | 'DISQUALIFIED';
  initialWeightCategoryName: string | null;
  finalWeightCategoryName: string | null;
  movedUp: boolean;
  latestWeighInDecision?: WeighInDecision | null;
  latestWeighInAt?: string | null;
}

export interface AthleteProfileFightRow {
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
}

export interface AthleteProfileResponse {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    sex: AthleteSex | null;
    dateOfBirth?: string | null;
    club: AthleteProfileClubRow | null;
    coaches?: AthleteProfileCoachRow[];
  };
  registrations: AthleteProfileRegistrationRow[];
  fights: AthleteProfileFightRow[];
}

export interface MatRow {
  id: string;
  eventId: string;
  name: string;
  label: string | null;
  order?: number;
}

export interface NewsPostRow {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  published: boolean;
  eventId?: string | null;
  event?: { id: string; name: string; slug: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSubmissionRow {
  id: string;
  type: string;
  name: string;
  email: string;
  message: string | null;
  clubName: string | null;
  notes: string | null;
  status: SubmissionStatus;
  createdAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clubId: string | null;
  club: { id: string; name: string } | null;
}

export interface UserDetailRow {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'coach';
  status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE';
  isActive: boolean;
  clubId: string | null;
  club: { id: string; name: string } | null;
  disciplinary: {
    isActive: boolean;
    reason: string | null;
    note: string | null;
    startAt: string | null;
    endAt: string | null;
  };
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface UserCapabilityRow {
  code: string;
  granted: boolean;
  isDefault: boolean;
  isCustom: boolean;
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
