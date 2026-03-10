import type { EventLifecycle, FightStatus } from '@prisma/client';
import type {
  BracketIssue,
  BracketPublicationStatus,
  BracketViewStatus,
} from './brackets.types';
import type { CompetitionFormat } from './competition-format';

const COMPLETE_FIGHT_STATUSES = new Set<FightStatus>(['COMPLETE', 'CONFIRMED']);
const IN_PROGRESS_FIGHT_STATUSES = new Set<FightStatus>([
  'IN_PROGRESS',
  'PAUSED',
  'ON_DECK',
]);

export type BracketStatusInput = {
  hasFights: boolean;
  totalFights: number;
  hasAnyBracketInEvent: boolean;
  eligibleAthletesCount: number;
  completedFightsCount: number;
  inProgressFightsCount: number;
  hasIntegrityIssue: boolean;
  eventPublished: boolean;
};

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

  if (input.inProgressFightsCount > 0 || input.completedFightsCount > 0) {
    return 'IN_PROGRESS';
  }

  return input.eventPublished ? 'PUBLISHED' : 'GENERATED_DRAFT';
}

export function derivePublicationStatus(input: {
  hasFights: boolean;
  eventPublished: boolean;
}): BracketPublicationStatus {
  if (!input.hasFights) return 'DRAFT';
  return input.eventPublished ? 'PUBLISHED' : 'DRAFT';
}

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
  if (
    input.competitionFormat !== 'ROUND_ROBIN' &&
    input.hasMissingFinalRound
  ) {
    issues.push({ code: 'MISSING_FINAL_FIGHT', severity: 'WARNING' });
  }
  if (
    input.competitionFormat !== 'ROUND_ROBIN' &&
    input.duplicateAthleteInOpeningRound
  ) {
    issues.push({ code: 'DUPLICATE_OPENING_ROUND_ATHLETE', severity: 'CRITICAL' });
  }
  if (
    input.competitionFormat !== 'ROUND_ROBIN' &&
    input.duplicateAthleteInActiveFights
  ) {
    issues.push({ code: 'DUPLICATE_ACTIVE_FIGHT_ATHLETE', severity: 'CRITICAL' });
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

export function extractScoreToken(input: string | null): string | null {
  if (!input) return null;
  const match = input.match(/(\d{1,2}\s*[-:]\s*\d{1,2})/);
  return match ? match[1].replace(/\s+/g, '') : null;
}
