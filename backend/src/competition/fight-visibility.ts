import type { FightStatus } from '@prisma/client';

// Canonical fight-visibility rules, shared by FightsService, ScheduleService,
// and the schedule-ordering primitives (schedule-fight-candidates.logic).
// Each of those previously carried its own byte-identical copy — three copies
// of isFightPlayable and three of isScheduleVisibleFight. Pure: no Prisma, no
// Nest, only structural inputs, so every caller can depend on it without
// pulling in the others.

// A fight is runnable iff both corners are filled with DISTINCT athletes, no
// winner is recorded yet, and it sits in a queued/live status. Used by the
// auto-scheduler, per-mat queue computation, and the schedulability guard.
// NOTE: IN_PROGRESS/PAUSED count as playable here; callers that must not
// relocate an actively-contested bout apply their own extra check (e.g. the
// schedule move guard's BF-17 rule).
export function isFightPlayable(fight: {
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId?: string | null;
  status: FightStatus;
}): boolean {
  if (!fight.redAthleteId || !fight.blueAthleteId) return false;
  if (fight.redAthleteId === fight.blueAthleteId) return false;
  if (fight.winnerAthleteId) return false;
  return (
    fight.status === 'QUEUED' ||
    fight.status === 'ON_DECK' ||
    fight.status === 'IN_PROGRESS' ||
    fight.status === 'PAUSED'
  );
}

// Decide whether a fight should appear in the schedule view at all. Hides:
//   - dead nodes: no athletes AND no upstream dependency (structural
//     placeholders that exist only to make the bracket-tree math work),
//   - first-round BYEs: exactly one side filled in the opening round.
// Everything else is visible — even "Winner of N" cells with no real athletes
// yet, because admins want to see where the bout will land.
export function isScheduleVisibleFight(input: {
  fight: {
    redAthleteId: string | null;
    blueAthleteId: string | null;
    round: number;
  };
  openingRound: number;
  hasSourceDependencies: boolean;
}): boolean {
  const redKnown = !!input.fight.redAthleteId;
  const blueKnown = !!input.fight.blueAthleteId;

  if (!redKnown && !blueKnown && !input.hasSourceDependencies) return false;
  if (input.fight.round === input.openingRound && redKnown !== blueKnown) {
    return false;
  }
  return true;
}
