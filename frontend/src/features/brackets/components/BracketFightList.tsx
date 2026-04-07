'use client';

import type { BracketFightListRow } from '@/types/api';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/primitives/table';
import { resolveBracketParticipantLabel } from '@/domain/brackets/participantSlots';

type Props = {
  fights: BracketFightListRow[];
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tFightStatus: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketFightList({ fights, t, tFightStatus }: Props) {
  const emptyValue = t('valueUnavailable');
  const slotTextClass = (kind: BracketFightListRow['redSlot']['kind']) => {
    if (kind === 'ATHLETE') return 'text-[var(--color-text)]';
    if (kind === 'WINNER_PLACEHOLDER') return 'text-[var(--color-text-muted)]';
    if (kind === 'BYE') return 'uppercase tracking-[0.08em] text-[var(--color-text-muted)]';
    return 'text-[var(--color-danger)]';
  };

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
      <Table className="min-w-full text-[12px]">
        <TableHeader>
          <TableRow className="border-0 bg-[var(--color-surface-alt)]">
            <TableHead>{t('fightColumns.bout')}</TableHead>
            <TableHead>{t('fightColumns.stage')}</TableHead>
            <TableHead>{t('fightColumns.red')}</TableHead>
            <TableHead>{t('fightColumns.blue')}</TableHead>
            <TableHead>{t('fightColumns.status')}</TableHead>
            <TableHead>{t('fightColumns.result')}</TableHead>
            <TableHead>{t('fightColumns.schedule')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fights.map((fight) => (
            <TableRow key={fight.id}>
              <TableCell className="text-[var(--color-text)]">#{fight.boutNo}</TableCell>
              <TableCell className="text-[var(--color-text)]">
                {fight.stageLabel === 'ROUND_ROBIN'
                  ? t('roundLabel.ROUND_ROBIN')
                  : fight.stageLabel.startsWith('ROUND_')
                  ? t('roundLabel.ROUND', { round: fight.round })
                  : t(`roundLabel.${fight.stageLabel}`)}
              </TableCell>
              <TableCell className={slotTextClass(fight.redSlot.kind)}>
                {resolveBracketParticipantLabel({ slot: fight.redSlot, tBracket: t })}
              </TableCell>
              <TableCell className={slotTextClass(fight.blueSlot.kind)}>
                {resolveBracketParticipantLabel({ slot: fight.blueSlot, tBracket: t })}
              </TableCell>
              <TableCell className="text-[var(--color-text)]">
                <StatusChip status={fight.status} label={tFightStatus(fight.status)} domain="fight" />
              </TableCell>
              <TableCell className="text-[var(--color-text)]">
                {fight.score ?? fight.winMethod ?? emptyValue}
              </TableCell>
              <TableCell className="text-[var(--color-text-muted)]">
                {fight.matName
                  ? `${fight.matName}${fight.orderInMat ? ` · #${fight.orderInMat}` : ''}`
                  : emptyValue}
              </TableCell>
            </TableRow>
          ))}
          {fights.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-3 text-[var(--color-text-muted)]">
                {t('emptyFights')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
