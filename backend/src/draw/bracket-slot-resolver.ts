import type { CompetitionFormat } from './competition-format';
import type { BracketParticipantSlotView, BracketParticipantView } from './brackets.types';

type FightSlotSource = {
  round: number;
  boutNo: number;
  redAthleteId: string | null;
  blueAthleteId: string | null;
};

type SourceFightRef = {
  id: string;
};

export function sourceBoutNoForSide(input: {
  fight: Pick<FightSlotSource, 'boutNo'>;
  side: 'red' | 'blue';
}): number {
  return input.side === 'red'
    ? input.fight.boutNo * 2 - 1
    : input.fight.boutNo * 2;
}

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
