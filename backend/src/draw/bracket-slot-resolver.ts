import type { CompetitionFormat } from './competition-format';
import type {
  BracketParticipantSlotView,
  BracketParticipantView,
} from './brackets.types';

// Pure helper for shaping bracket cell content. Decides per slot whether to
// show an athlete, a "Winner of bout N" placeholder, a BYE, or TBD.

// Minimal shape we need from a fight row to resolve its red/blue slots.
type FightSlotSource = {
  round: number;
  boutNo: number;
  redAthleteId: string | null;
  blueAthleteId: string | null;
};

// Slim handle returned by getSourceFight — we only care if the source exists.
type SourceFightRef = {
  id: string;
};

// Bracket math: red comes from odd-indexed source bout, blue from even.
// For bout #3 → red slot's source bout is 5, blue's is 6 (one level deeper).
function sourceBoutNoForSide(input: {
  fight: Pick<FightSlotSource, 'boutNo'>;
  side: 'red' | 'blue';
}): number {
  return input.side === 'red'
    ? input.fight.boutNo * 2 - 1
    : input.fight.boutNo * 2;
}

// Decide what a single bracket cell (one side of one fight) should display.
// Decision tree:
//   1. Already has an athlete attached         → ATHLETE.
//   2. Round-robin (no winner propagation)     → TBD when empty.
//   3. Single-elim, after the opening round AND an upstream source fight
//      exists for this slot                    → WINNER_PLACEHOLDER.
//   4. Single-elim, opening round or no source,
//      but the OTHER side has an athlete       → BYE (walkover).
//   5. Otherwise                               → TBD.
// getSourceFight is provided by the caller because slot resolution depends on
// the bracket's fight map, which lives in BracketsService.
export function resolveBracketParticipantSlot(input: {
  side: 'red' | 'blue';
  fight: FightSlotSource;
  participant: BracketParticipantView | null;
  competitionFormat: CompetitionFormat;
  openingRound: number;
  getSourceFight: (sourceBoutNo: number) => SourceFightRef | null;
}): BracketParticipantSlotView {
  if (input.participant) {
    return {
      kind: 'ATHLETE',
      sourceBoutNo: null,
      athlete: input.participant,
    };
  }

  if (input.competitionFormat !== 'SINGLE_ELIMINATION') {
    return {
      kind: 'TBD',
      sourceBoutNo: null,
      athlete: null,
    };
  }

  const sourceBoutNo = sourceBoutNoForSide({
    fight: input.fight,
    side: input.side,
  });
  const sourceFight =
    input.fight.round > input.openingRound
      ? input.getSourceFight(sourceBoutNo)
      : null;

  if (sourceFight) {
    return {
      kind: 'WINNER_PLACEHOLDER',
      sourceBoutNo,
      athlete: null,
    };
  }

  const opponentPresent =
    input.side === 'red'
      ? input.fight.blueAthleteId != null
      : input.fight.redAthleteId != null;

  if (opponentPresent) {
    return {
      kind: 'BYE',
      sourceBoutNo: null,
      athlete: null,
    };
  }

  return {
    kind: 'TBD',
    sourceBoutNo: null,
    athlete: null,
  };
}
