import type {
  CompetitionFormat,
  FightStatus,
  MatRow,
  TimerState,
  WinMethod,
} from '@/types/api';

type LiveQueueStatus = 'PENDING' | 'UPCOMING' | 'RUNNING' | 'FINISHED';

export interface LiveQueueFightRow {
  id: string;
  /** Fight row-version (ISO) — pass as expectedUpdatedAt on result writes (BF-2). */
  updatedAt: string;
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
  redDisplayNameKa?: string | null;
  blueDisplayNameKa?: string | null;
  redClubName: string | null;
  redClubNameKa: string | null;
  blueClubName: string | null;
  blueClubNameKa: string | null;
  matId: string | null;
  matName: string | null;
  orderInMat: number | null;
  orderInSession: number | null;
  sessionId: string | null;
  sessionName: string | null;
  sessionOrder: number | null;
  scheduledAt: string | null;
  timerState: TimerState | null;
}

export interface LiveSessionSummary {
  id: string;
  name: string;
  order: number;
}

export interface LiveQueueBoardResponse {
  eventId: string;
  mats: MatRow[];
  sessions: LiveSessionSummary[];
  allFights: LiveQueueFightRow[];
  selectedMatId: string | null;
  currentFight: LiveQueueFightRow | null;
  onDeckFight: LiveQueueFightRow | null;
  nextFights: LiveQueueFightRow[];
  queuePreview: LiveQueueFightRow[];
  completedFights: LiveQueueFightRow[];
}
