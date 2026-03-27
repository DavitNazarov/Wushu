'use client';

import { FightResultBanner } from '@/components/fight/FightResultBanner';
import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { getFightWinnerCorner } from '@/lib/live/fightPresentation';
import type { LiveQueueFightRow } from '@/types/live';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const INPUT =
  'w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const PICKER =
  'rounded-[var(--radius-card)] border px-4 py-3 text-left transition';

type Props = {
  open: boolean;
  fight: LiveQueueFightRow | null;
  winner: 'RED' | 'BLUE';
  method: string;
  notes: string;
  onClose: () => void;
  onConfirm: () => void;
  onWinnerChange: (winner: 'RED' | 'BLUE') => void;
  onMethodChange: (method: string) => void;
  onNotesChange: (notes: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  tCommon: (key: string) => string;
};

export function LiveResultModal({
  open,
  fight,
  winner,
  method,
  notes,
  onClose,
  onConfirm,
  onWinnerChange,
  onMethodChange,
  onNotesChange,
  t,
  tCommon,
}: Props) {
  const previewWinnerName =
    winner === 'RED' ? fight?.redDisplayName ?? t('red') : fight?.blueDisplayName ?? t('blue');
  const previewCorner = getFightWinnerCorner({
    winnerAthleteId:
      winner === 'RED' ? fight?.redAthleteId ?? null : fight?.blueAthleteId ?? null,
    redAthleteId: fight?.redAthleteId ?? null,
    blueAthleteId: fight?.blueAthleteId ?? null,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('setResult')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <SecondaryButton onClick={onConfirm}>{t('confirm')}</SecondaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <FightResultBanner
          title={t('fightResult')}
          winnerName={previewWinnerName}
          winnerCorner={previewCorner}
          methodLabel={t(`methods.${method}`)}
          notes={notes || null}
          t={t}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={`${PICKER} ${
              winner === 'RED'
                ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger-subtle)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]'
            }`}
            onClick={() => onWinnerChange('RED')}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--color-danger)]">
              {t('red')}
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">
              {fight?.redDisplayName ?? t('red')}
            </p>
          </button>

          <button
            type="button"
            className={`${PICKER} ${
              winner === 'BLUE'
                ? 'border-sky-500/50 bg-sky-500/12'
                : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]'
            }`}
            onClick={() => onWinnerChange('BLUE')}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-sky-400">
              {t('blue')}
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">
              {fight?.blueDisplayName ?? t('blue')}
            </p>
          </button>
        </div>

        <label className="block text-[13px] font-medium text-[var(--color-text)]">
          {t('method')}
          <select
            className={`${SEL} mt-1 w-full`}
            value={method}
            onChange={(e) => onMethodChange(e.target.value)}
          >
            <option value="POINTS">{t('methods.POINTS')}</option>
            <option value="KO">{t('methods.KO')}</option>
            <option value="DQ">{t('methods.DQ')}</option>
            <option value="WO">{t('methods.WO')}</option>
          </select>
        </label>

        <label className="block text-[13px] font-medium text-[var(--color-text)]">
          {t('notes')}
          <textarea
            className={`${INPUT} mt-1 min-h-24`}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
