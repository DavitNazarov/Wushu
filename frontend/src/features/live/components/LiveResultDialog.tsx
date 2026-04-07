'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { FightResultBanner } from '@/components/fight/FightResultBanner';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { Textarea } from '@/components/ui/primitives/textarea';
import { getFightWinnerCorner } from '@/lib/live/fightPresentation';
import { cn } from '@/lib/utils';
import type { LiveQueueFightRow } from '@/types/live';

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

const PICKER =
  'rounded-[var(--radius-card)] border px-4 py-3 text-left transition';

export function LiveResultDialog({
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
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-[var(--radius-modal)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl outline-none"
          style={{ maxHeight: 'calc(100vh - 2rem)' }}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-[var(--color-text)]">
                {t('setResult')}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label={tCommon('close')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
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
                <Select value={method} onValueChange={onMethodChange}>
                  <SelectTrigger className="mt-1 h-10 w-full bg-[var(--color-surface)] px-3 py-2 text-[13px] shadow-none focus:ring-2 focus:ring-[var(--color-primary)]/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[14px] bg-[var(--color-surface)] text-[13px] shadow-xl">
                    <SelectItem value="POINTS" className="rounded-[10px] py-2 text-[13px]">
                      {t('methods.POINTS')}
                    </SelectItem>
                    <SelectItem value="KO" className="rounded-[10px] py-2 text-[13px]">
                      {t('methods.KO')}
                    </SelectItem>
                    <SelectItem value="DQ" className="rounded-[10px] py-2 text-[13px]">
                      {t('methods.DQ')}
                    </SelectItem>
                    <SelectItem value="WO" className="rounded-[10px] py-2 text-[13px]">
                      {t('methods.WO')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block text-[13px] font-medium text-[var(--color-text)]">
                {t('notes')}
                <Textarea
                  className={cn('mt-1 min-h-24 bg-[var(--color-surface)] px-3 py-3')}
                  value={notes}
                  onChange={(event) => onNotesChange(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
            <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
            <SecondaryButton onClick={onConfirm}>{t('confirm')}</SecondaryButton>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
