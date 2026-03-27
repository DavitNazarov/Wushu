import type { PublicResultRow } from '@/lib/api/public-results';

export function formatPublicResultStage(
  result: Pick<PublicResultRow, 'stageCode' | 'round' | 'boutNo'>,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (result.stageCode === 'ROUND_ROBIN') {
    return `${t('resultsStage.ROUND_ROBIN')} · ${t('resultsBout', { bout: result.boutNo })}`;
  }
  if (result.stageCode === 'FINAL') {
    return t('resultsStage.FINAL');
  }
  if (result.stageCode === 'SEMIFINAL') {
    return t('resultsStage.SEMIFINAL');
  }
  if (result.stageCode === 'QUARTERFINAL') {
    return t('resultsStage.QUARTERFINAL');
  }
  return t('resultsRound', { round: result.round, bout: result.boutNo });
}

export function formatPublicResultTime(
  scheduledAt: string | null,
  locale: string,
): string | null {
  if (!scheduledAt) return null;
  const date = new Date(scheduledAt);
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
