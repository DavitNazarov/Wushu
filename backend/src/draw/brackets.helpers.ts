import type { EventLifecycle, FightStatus } from '@prisma/client';
import type {
  BracketIssue,
  BracketPublicationStatus,
  BracketViewStatus,
} from './brackets.types';
import type { CompetitionFormat } from './competition-format';

// Pure helpers for the post-draw "Brackets" page. Status derivation, issue
// detection, round labels. No Prisma, no DI — every fn takes a plain input
// and returns a plain output for trivial testing.

// Fight statuses that count as "done" — covers both judge-confirmed and the
// pre-confirmation COMPLETE state.
const COMPLETE_FIGHT_STATUSES = new Set<FightStatus>(['COMPLETE', 'CONFIRMED']);

// "Something is happening on this fight right now" — used to pick the
// IN_PROGRESS bracket status and to know when a bracket can't be reset.
const IN_PROGRESS_FIGHT_STATUSES = new Set<FightStatus>([
  'IN_PROGRESS',
  'PAUSED',
  'ON_DECK',
]);

// Input shape for deriveBracketCategoryStatus. Carries the small set of
// per-bracket facts the status machine needs.
export type BracketStatusInput = {
  hasFights: boolean;
  totalFights: number;
  hasAnyBracketInEvent: boolean;
  eligibleAthletesCount: number;
  completedFightsCount: number;
  inProgressFightsCount: number;
  // Same counts but with BYE walkovers excluded. A BYE is auto-CONFIRMED at
  // draw time (DrawService.autoConfirmByes), so on its own it must NOT read as
  // real progress — otherwise a freshly-drawn bracket with an odd athlete
  // count wrongly shows IN_PROGRESS. Optional: when omitted, fall back to the
  // full counts (byes already excluded by the caller, or none present).
  nonByeCompletedFightsCount?: number;
  nonByeInProgressFightsCount?: number;
  hasIntegrityIssue: boolean;
  eventPublished: boolean;
};

// "Is this event in a publicly-visible state?" — true if either the explicit
// flag is on OR the lifecycle has moved past DRAWN. Used everywhere we need
// to know if changes should be visible to the public.
export function isEventPublished(input: {
  lifecycle: EventLifecycle;
  published: boolean;
}): boolean {
  if (input.published) return true;
  return (
    input.lifecycle === 'PUBLISHED' ||
    input.lifecycle === 'LIVE' ||
    input.lifecycle === 'COMPLETED'
  );
}

// One-pass counter over an array of fight statuses. Returns how many fights
// are done and how many are mid-fight, so the UI can show "5 of 8 fights
// complete, 2 in progress".
export function fightStateCounters(statuses: FightStatus[]): {
  completed: number;
  inProgress: number;
} {
  let completed = 0;
  let inProgress = 0;

  for (const status of statuses) {
    if (COMPLETE_FIGHT_STATUSES.has(status)) {
      completed += 1;
      continue;
    }
    if (IN_PROGRESS_FIGHT_STATUSES.has(status)) {
      inProgress += 1;
    }
  }

  return { completed, inProgress };
}

// Can this fight be reorganised by an admin bracket swap? A fight is locked
// once it's genuinely contested:
//   - running          : IN_PROGRESS / PAUSED
//   - a real result     : CONFIRMED / COMPLETE *with both athletes assigned*
// A CONFIRMED single-sided BYE is NOT a real result — it's an auto-advance
// walkover (DrawService.autoConfirmByes) — so a byed athlete stays swappable;
// the bye is re-resolved + re-propagated after the swap.
export function isSwapLockedFight(input: {
  status: FightStatus;
  redAthleteId: string | null;
  blueAthleteId: string | null;
}): boolean {
  if (input.status === 'IN_PROGRESS' || input.status === 'PAUSED') return true;
  const isBye = (input.redAthleteId == null) !== (input.blueAthleteId == null);
  return (
    (input.status === 'CONFIRMED' || input.status === 'COMPLETE') && !isBye
  );
}

// Pill shown next to each bracket. Priority order:
//   No fights:
//     EMPTY          (no eligible athletes ever)
//     NOT_GENERATED  (other brackets in this event drawn but not this one)
//     NEEDS_REVIEW   (some brackets generated, this one missing — drift)
//   Has fights:
//     NEEDS_REVIEW   (integrity issue detected)
//     COMPLETED      (every fight done, none in progress)
//     IN_PROGRESS    (a NON-BYE fight is running OR partially completed)
//     PUBLISHED      (event flagged published and nothing real has started)
//     GENERATED_DRAFT (drawn but not yet published)
// BF: BYE walkovers are auto-CONFIRMED at draw, so they're excluded from the
// IN_PROGRESS trigger — a bracket whose only completed fights are byes is still
// just "generated", not "in progress".
export function deriveBracketCategoryStatus(
  input: BracketStatusInput,
): BracketViewStatus {
  if (!input.hasFights) {
    if (input.eligibleAthletesCount === 0) return 'EMPTY';
    if (!input.hasAnyBracketInEvent) return 'NOT_GENERATED';
    return 'NEEDS_REVIEW';
  }

  if (input.hasIntegrityIssue) return 'NEEDS_REVIEW';
  if (
    input.totalFights > 0 &&
    input.completedFightsCount === input.totalFights &&
    input.inProgressFightsCount === 0
  ) {
    return 'COMPLETED';
  }

  const realCompleted =
    input.nonByeCompletedFightsCount ?? input.completedFightsCount;
  const realInProgress =
    input.nonByeInProgressFightsCount ?? input.inProgressFightsCount;
  if (realInProgress > 0 || realCompleted > 0) {
    return 'IN_PROGRESS';
  }

  return input.eventPublished ? 'PUBLISHED' : 'GENERATED_DRAFT';
}

// Two-state publication pill for the brackets list. DRAFT until both
// fights exist AND the event is published.
export function derivePublicationStatus(input: {
  hasFights: boolean;
  eventPublished: boolean;
}): BracketPublicationStatus {
  if (!input.hasFights) return 'DRAFT';
  return input.eventPublished ? 'PUBLISHED' : 'DRAFT';
}

// Catalog of structural integrity checks on a bracket. Each input flag is
// computed by BracketsService.getCategoryDetails; this fn turns them into
// the user-visible issue list. Code/severity pairings:
//   INVALID_EMPTY_FIGHT          CRITICAL  — fight row with neither athlete + not a BYE
//   MISSING_FIGHT_WINNER         CRITICAL  — COMPLETE/CONFIRMED but no winner attached
//   MISSING_FINAL_FIGHT          WARNING   — single-elim missing the final fight row
//   DUPLICATE_OPENING_ROUND_ATHLETE CRITICAL — same athlete on two R1 fights
//   DUPLICATE_ACTIVE_FIGHT_ATHLETE  CRITICAL — same athlete appears twice as athlete
//   ROUND_ROBIN_INVALID_BYE      CRITICAL  — round-robin should never have BYEs
//   ROUND_ROBIN_MISSING_PAIRINGS CRITICAL  — not every pair was generated
// Round-robin-only and bracket-only branches are mutually exclusive.
export function detectCategoryIntegrityIssues(input: {
  competitionFormat: CompetitionFormat;
  hasFights: boolean;
  hasInvalidBlankFights: boolean;
  completeWithoutWinner: boolean;
  hasMissingFinalRound: boolean;
  duplicateAthleteInOpeningRound: boolean;
  duplicateAthleteInActiveFights: boolean;
  hasRoundRobinMissingPairings: boolean;
  hasRoundRobinByes: boolean;
}): BracketIssue[] {
  const issues: BracketIssue[] = [];

  if (!input.hasFights) return issues;
  if (input.hasInvalidBlankFights) {
    issues.push({ code: 'INVALID_EMPTY_FIGHT', severity: 'CRITICAL' });
  }
  if (input.completeWithoutWinner) {
    issues.push({ code: 'MISSING_FIGHT_WINNER', severity: 'CRITICAL' });
  }
  if (input.competitionFormat !== 'ROUND_ROBIN' && input.hasMissingFinalRound) {
    issues.push({ code: 'MISSING_FINAL_FIGHT', severity: 'WARNING' });
  }
  if (
    input.competitionFormat !== 'ROUND_ROBIN' &&
    input.duplicateAthleteInOpeningRound
  ) {
    issues.push({
      code: 'DUPLICATE_OPENING_ROUND_ATHLETE',
      severity: 'CRITICAL',
    });
  }
  if (
    input.competitionFormat !== 'ROUND_ROBIN' &&
    input.duplicateAthleteInActiveFights
  ) {
    issues.push({
      code: 'DUPLICATE_ACTIVE_FIGHT_ATHLETE',
      severity: 'CRITICAL',
    });
  }
  if (input.competitionFormat === 'ROUND_ROBIN' && input.hasRoundRobinByes) {
    issues.push({ code: 'ROUND_ROBIN_INVALID_BYE', severity: 'CRITICAL' });
  }
  if (
    input.competitionFormat === 'ROUND_ROBIN' &&
    input.hasRoundRobinMissingPairings
  ) {
    issues.push({ code: 'ROUND_ROBIN_MISSING_PAIRINGS', severity: 'CRITICAL' });
  }

  return issues;
}

// Map a round number to a stage label the UI / public site display.
// Last round = FINAL, second-last = SEMIFINAL, third-last = QUARTERFINAL,
// everything earlier = ROUND_N. Round-robin always reports ROUND_ROBIN.
export function roundStageLabel(
  round: number,
  maxRound: number,
  competitionFormat: CompetitionFormat,
): string {
  if (competitionFormat === 'ROUND_ROBIN') return 'ROUND_ROBIN';
  if (round === maxRound) return 'FINAL';
  if (round === maxRound - 1) return 'SEMIFINAL';
  if (round === maxRound - 2) return 'QUARTERFINAL';
  return `ROUND_${round}`;
}

// Pull a score-looking token (e.g. "5-2", "10:8") out of fight.notes. Scores
// are stored inside notes for legacy reasons — there's no first-class column.
// Strips internal whitespace so "5 - 2" becomes "5-2" for display.
// Returns null when notes is empty or no token matches.
export function extractScoreToken(input: string | null): string | null {
  if (!input) return null;
  const match = input.match(/(\d{1,2}\s*[-:]\s*\d{1,2})/);
  return match ? match[1].replace(/\s+/g, '') : null;
}
