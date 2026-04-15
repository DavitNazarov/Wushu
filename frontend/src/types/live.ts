import type {
  CompetitionFormat,
  FightStatus,
  MatRow,
  TimerState,
  WinMethod,
} from '@/types/api';

export type LiveQueueStatus = 'PENDING' | 'UPCOMING' | 'RUNNING' | 'FINISHED';

export interface LiveQueueFightRow {
  id: string;
  categoryCode: string;
  categoryName: string;
  ageGroupName: string | null;
  competitionFormat: CompetitionFormat;
  round: number;
  boutNo: number;
  bracketRoundLabel: string;
  scheduleOrder: number | null;
  status: FightStatus;
  liveStatus: LiveQueueStatus;
  isPlayable: boolean;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  winnerAthleteId: string | null;
  winMethod: WinMethod | null;
  notes: string | null;
  redDisplayName: string;
  blueDisplayName: string;
  matId: string | null;
  matName: string | null;
  orderInMat: number | null;
  orderInSession: number | null;
  scheduledAt: string | null;
  timerState: TimerState | null;
}

export interface LiveQueueBoardResponse {
  eventId: string;
  mats: MatRow[];
  selectedMatId: string | null;
  currentFight: LiveQueueFightRow | null;
  onDeckFight: LiveQueueFightRow | null;
  nextFights: LiveQueueFightRow[];
  queuePreview: LiveQueueFightRow[];
  completedFights: LiveQueueFightRow[];
}
