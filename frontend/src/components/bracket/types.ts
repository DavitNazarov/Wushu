type BracketRendererParticipant = {
  athleteId: string;
  name: string;
  club: string | null;
  country: string | null;
  movedUp: boolean;
  overrideUsed: boolean;
  winner: boolean;
};

export type BracketRendererParticipantSlot =
  | {
      type: 'athlete';
      athlete: BracketRendererParticipant;
    }
  | {
      type: 'pending_winner';
      sourceFightNumber: number;
    }
  | {
      type: 'bye';
    }
  | {
      type: 'empty_invalid';
    };

export type BracketRendererMatch = {
  id: string;
  fightNumber: number;
  status: string;
  score: string | null;
  winMethod: string | null;
  winnerAthleteId: string | null;
  isBye: boolean;
  participants: {
    a: BracketRendererParticipantSlot;
    b: BracketRendererParticipantSlot;
  };
};

export type BracketRendererRound = {
  id: string;
  label: string;
  roundNumber: number;
  accent: 'cyan' | 'amber' | 'red' | 'purple' | 'slate';
  matches: BracketRendererMatch[];
};

export type BracketRendererData = {
  rounds: BracketRendererRound[];
};
