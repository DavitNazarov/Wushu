'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/primitives/dialog';
import type { BracketsOverviewResponse } from '@/types/api';

type Props = {
  open: boolean;
  overview: BracketsOverviewResponse | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (payload: { sameClubSeparation: boolean }) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tCommon: (key: string) => string;
};

// First-time draw confirmation. Unlike Regenerate this is non-destructive, so
// there's no reason / confirm-token gate — just a same-club separation option.
export function BracketGenerateDialog({
  open,
  overview,
  pending,
  onClose,
  onConfirm,
  t,
  tCommon,
}: Props) {
  const [sameClubSeparation, setSameClubSeparation] = useState(true);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{t('generateDialogTitle')}</DialogTitle>
          <DialogDescription>{t('generateDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-[13px] text-[var(--color-text)]">
          {overview && (
            <ul className="space-y-1 text-[12px] text-[var(--color-text-muted)]">
              <li>
                {t('generateDialogSummaryCategories', {
                  count: overview.summary.totalCategories,
                })}
              </li>
            </ul>
          )}

          <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5">
            <input
              type="checkbox"
              checked={sameClubSeparation}
              onChange={(event) => setSameClubSeparation(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span>
              <span className="block font-medium text-[var(--color-text)]">
                {t('generateSameClubLabel')}
              </span>
              <span className="block text-[12px] text-[var(--color-text-muted)]">
                {t('generateSameClubHint')}
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            disabled={pending || !overview}
            onClick={() => onConfirm({ sameClubSeparation })}
          >
            {pending ? t('actionGenerating') : t('actionGenerate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
