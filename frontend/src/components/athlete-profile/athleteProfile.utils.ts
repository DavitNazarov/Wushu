import type { AthleteProfileFightRow } from '@/types/api';

export function formatAthleteDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fightOutcomeForAthlete(fight: AthleteProfileFightRow, athleteId: string): 'win' | 'loss' | 'pending' {
  if (!fight.winnerAthleteId) return 'pending';
  return fight.winnerAthleteId === athleteId ? 'win' : 'loss';
}

export function sortFights(input: AthleteProfileFightRow[]): AthleteProfileFightRow[] {
  return [...input].sort((left, right) => {
    const leftTime = left.scheduledStartTime ? new Date(left.scheduledStartTime).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.scheduledStartTime ? new Date(right.scheduledStartTime).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    if (left.eventName !== right.eventName) return left.eventName.localeCompare(right.eventName);
    if (left.round !== right.round) return left.round - right.round;
    return left.boutNo - right.boutNo;
  });
}
