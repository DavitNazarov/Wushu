// Shared string-literal/union types used across the API type surface. Kept in
// one place so domain modules (catalog, competition, admin) can reference them
// without cross-importing each other. Re-exported from the ./api barrel, so
// `import { ... } from '@/types/api'` keeps working unchanged.

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

export type DrawIssueSeverity = 'CRITICAL' | 'WARNING';
export type DrawOverallStatus = 'NOT_GENERATED' | 'GENERATED' | 'PUBLISHED';
export type DrawBracketStatus = 'NOT_DRAWN' | 'DRAWN';
export type DrawCategoryStatus =
  | 'READY'
  | 'BLOCKED'
  | 'DRAWN'
  | 'EMPTY'
  | 'SOLO'
  | 'NEEDS_REVIEW';

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
