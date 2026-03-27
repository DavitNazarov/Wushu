import type { BracketRoundColumn } from '@/types/api';
import type {
  BracketRendererData,
  BracketRendererParticipantSlot,
  BracketRendererRound,
} from './types';

function accentForRound(index: number, total: number): BracketRendererRound['accent'] {
  if (total <= 1) return 'purple';
  if (index === total - 1) return 'purple';
  if (index === total - 2) return 'red';
  if (index === total - 3) return 'amber';
  if (index === 0) return 'cyan';
  return 'slate';
}

function toBracketRendererParticipantSlot(input: {
  slot: BracketRoundColumn['matchups'][number]['slots']['red'];
  winnerAthleteId: string | null;
}): BracketRendererParticipantSlot {
  if (input.slot.kind === 'ATHLETE' && input.slot.athlete) {
    return {
      type: 'athlete',
      athlete: {
        athleteId: input.slot.athlete.athleteId,
        name: input.slot.athlete.athleteName,
        club: input.slot.athlete.clubName,
        country: input.slot.athlete.country,
        movedUp: input.slot.athlete.movedUp,
        overrideUsed: input.slot.athlete.overrideUsed,
        winner: input.winnerAthleteId === input.slot.athlete.athleteId,
      },
    };
  }

  if (input.slot.kind === 'WINNER_PLACEHOLDER' && input.slot.sourceBoutNo != null) {
    return {
      type: 'pending_winner',
      sourceFightNumber: input.slot.sourceBoutNo,
    };
  }

  if (input.slot.kind === 'BYE') {
    return { type: 'bye' };
  }

  return { type: 'empty_invalid' };
}

function mapMatch(input: {
  matchup: BracketRoundColumn['matchups'][number];
}) {
  const matchup = input.matchup;
  return {
    id: matchup.fightId,
    fightNumber: matchup.boutNo,
    status: matchup.status,
    score: matchup.score,
    winMethod: matchup.winMethod,
    winnerAthleteId: matchup.winnerAthleteId,
    isBye: matchup.isBye,
    participants: {
      a: toBracketRendererParticipantSlot({
        slot: matchup.slots.red,
        winnerAthleteId: matchup.winnerAthleteId,
      }),
      b: toBracketRendererParticipantSlot({
        slot: matchup.slots.blue,
        winnerAthleteId: matchup.winnerAthleteId,
      }),
    },
  };
}

export function mapRoundsToBracketRendererData(rounds: BracketRoundColumn[]): BracketRendererData {
  return {
    rounds: rounds.map((round, roundIndex) => {
      return {
        id: `${round.round}`,
        label: round.label,
        roundNumber: round.round,
        accent: accentForRound(roundIndex, rounds.length),
        matches: round.matchups.map((matchup) =>
          mapMatch({
            matchup,
          }),
        ),
      };
    }),
  };
}

export function countryToFlag(country: string | null): string | null {
  if (!country) return null;
  const normalized = country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;

  const codePoints = [...normalized].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
