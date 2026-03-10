import type { BracketRoundColumn } from '@/types/api';
import type {
  BracketRendererData,
  BracketRendererMatch,
  BracketRendererParticipant,
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

function participant(input: {
  athleteId: string;
  athleteName: string;
  clubName: string | null;
  country: string | null;
  movedUp: boolean;
  overrideUsed: boolean;
  winnerAthleteId: string | null;
}): BracketRendererParticipant {
  return {
    athleteId: input.athleteId,
    name: input.athleteName,
    club: input.clubName,
    country: input.country,
    movedUp: input.movedUp,
    overrideUsed: input.overrideUsed,
    winner: input.winnerAthleteId === input.athleteId,
  };
}

function toParticipantSlot(input: {
  roundIndex: number;
  participant: BracketRoundColumn['matchups'][number]['participants']['red'] | BracketRoundColumn['matchups'][number]['participants']['blue'];
  winnerAthleteId: string | null;
  isBye: boolean;
  sourceMatch: BracketRoundColumn['matchups'][number] | null;
}): BracketRendererParticipantSlot {
  if (input.participant) {
    return {
      type: 'athlete',
      athlete: participant({
        athleteId: input.participant.athleteId,
        athleteName: input.participant.athleteName,
        clubName: input.participant.clubName,
        country: input.participant.country,
        movedUp: input.participant.movedUp,
        overrideUsed: input.participant.overrideUsed,
        winnerAthleteId: input.winnerAthleteId,
      }),
    };
  }

  if (input.isBye) {
    return { type: 'bye' };
  }

  if (input.sourceMatch) {
    return {
      type: 'pending_winner',
      sourceFightNumber: input.sourceMatch.boutNo,
    };
  }

  if (input.roundIndex === 0) {
    return { type: 'empty_invalid' };
  }

  return { type: 'empty_invalid' };
}

function mapMatch(input: {
  roundIndex: number;
  matchup: BracketRoundColumn['matchups'][number];
  sourceMatchA: BracketRoundColumn['matchups'][number] | null;
  sourceMatchB: BracketRoundColumn['matchups'][number] | null;
}): BracketRendererMatch {
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
      a: toParticipantSlot({
        roundIndex: input.roundIndex,
        participant: matchup.participants.red,
        winnerAthleteId: matchup.winnerAthleteId,
        isBye: matchup.isBye,
        sourceMatch: input.sourceMatchA,
      }),
      b: toParticipantSlot({
        roundIndex: input.roundIndex,
        participant: matchup.participants.blue,
        winnerAthleteId: matchup.winnerAthleteId,
        isBye: matchup.isBye,
        sourceMatch: input.sourceMatchB,
      }),
    },
  };
}

export function mapRoundsToBracketRendererData(rounds: BracketRoundColumn[]): BracketRendererData {
  return {
    rounds: rounds.map((round, roundIndex) => {
      const previousRound = rounds[roundIndex - 1];
      return {
        id: `${round.round}`,
        label: round.label,
        roundNumber: round.round,
        accent: accentForRound(roundIndex, rounds.length),
        matches: round.matchups.map((matchup, matchupIndex) =>
          mapMatch({
            roundIndex,
            matchup,
            sourceMatchA: previousRound?.matchups[matchupIndex * 2] ?? null,
            sourceMatchB: previousRound?.matchups[matchupIndex * 2 + 1] ?? null,
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
