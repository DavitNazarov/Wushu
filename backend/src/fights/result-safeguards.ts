import type { FightStatus, WinMethod } from '@prisma/client';

type ResultSnapshot = {
  status: FightStatus;
  winnerAthleteId: string | null;
};

type DownstreamSnapshot = {
  status: FightStatus;
  winnerAthleteId: string | null;
  loserAthleteId: string | null;
  winMethod: WinMethod | null;
  confirmedAt: Date | null;
  timerState?: {
    state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED';
  } | null;
};

export function hasRecordedResult(fight: ResultSnapshot): boolean {
  return (
    fight.winnerAthleteId != null ||
    fight.status === 'COMPLETE' ||
    fight.status === 'CONFIRMED'
  );
}

export function isDownstreamFightLocked(fight: DownstreamSnapshot): boolean {
  if (fight.status !== 'QUEUED') {
    return true;
  }
  if (
    fight.winnerAthleteId != null ||
    fight.loserAthleteId != null ||
    fight.winMethod != null ||
    fight.confirmedAt != null
  ) {
    return true;
  }
  if (
    fight.timerState &&
    fight.timerState.state !== 'IDLE' &&
    fight.timerState.state !== 'FINISHED'
  ) {
    return true;
  }
  return false;
}
