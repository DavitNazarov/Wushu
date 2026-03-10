'use client';

import type { BracketFightListRow } from '@/types/api';
import { StatusChip } from '@/components/ui/StatusChip';

type Props = {
  fights: BracketFightListRow[];
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tFightStatus: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketFightList({ fights, t, tFightStatus }: Props) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
      <table className="min-w-full text-[12px]">
        <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
          <tr>
            <th className="px-2 py-2 text-left font-medium">{t('fightColumns.bout')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('fightColumns.stage')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('fightColumns.red')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('fightColumns.blue')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('fightColumns.status')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('fightColumns.result')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('fightColumns.schedule')}</th>
          </tr>
        </thead>
        <tbody>
          {fights.map((fight) => (
            <tr key={fight.id} className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
              <td className="px-2 py-2 text-[var(--color-text)]">#{fight.boutNo}</td>
              <td className="px-2 py-2 text-[var(--color-text)]">
                {fight.stageLabel === 'ROUND_ROBIN'
                  ? t('roundLabel.ROUND_ROBIN')
                  : fight.stageLabel.startsWith('ROUND_')
                  ? t('roundLabel.ROUND', { round: fight.round })
                  : t(`roundLabel.${fight.stageLabel}`)}
              </td>
              <td className="px-2 py-2 text-[var(--color-text)]">{fight.redAthleteName ?? t('bye')}</td>
              <td className="px-2 py-2 text-[var(--color-text)]">{fight.blueAthleteName ?? t('bye')}</td>
              <td className="px-2 py-2 text-[var(--color-text)]">
                <StatusChip status={fight.status} label={tFightStatus(fight.status)} domain="fight" />
              </td>
              <td className="px-2 py-2 text-[var(--color-text)]">
                {fight.score ?? fight.winMethod ?? '—'}
              </td>
              <td className="px-2 py-2 text-[var(--color-text-muted)]">
                {fight.matName
                  ? `${fight.matName}${fight.orderInMat ? ` · #${fight.orderInMat}` : ''}`
                  : '—'}
              </td>
            </tr>
          ))}
          {fights.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-3 text-[var(--color-text-muted)]">
                {t('emptyFights')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
