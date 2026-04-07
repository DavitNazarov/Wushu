'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/primitives/dialog';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import { Textarea } from '@/components/ui/primitives/textarea';
import type { BracketsOverviewResponse } from '@/types/api';

type Props = {
  open: boolean;
  overview: BracketsOverviewResponse | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string }) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tCommon: (key: string) => string;
};

export function BracketRegenerateDialog({
  open,
  overview,
  pending,
  onClose,
  onConfirm,
  t,
  tCommon,
}: Props) {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const confirmToken = t('regenerateConfirmToken');

  const canSubmit = useMemo(
    () => reason.trim().length >= 5 && confirm.trim() === confirmToken,
    [reason, confirm, confirmToken],
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{t('regenerateDialogTitle')}</DialogTitle>
          <DialogDescription>{t('regenerateDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-[13px] text-[var(--color-text)]">
          <p>{t('regenerateDialogWarning')}</p>

          {overview && (
            <ul className="space-y-1 text-[12px] text-[var(--color-text-muted)]">
              <li>{t('publishDialogSummaryCategories', { count: overview.summary.categoriesWithBrackets })}</li>
              <li>{t('publishDialogSummaryAthletes', { count: overview.summary.totalAthletesInBrackets })}</li>
              <li>{t('publishDialogSummaryByes', { count: overview.summary.totalByes })}</li>
            </ul>
          )}

          <div className="space-y-1">
            <Label htmlFor="brackets-regenerate-reason">{t('reasonLabel')}</Label>
            <Textarea
              id="brackets-regenerate-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-[104px] bg-[var(--color-surface)]"
              placeholder={t('regenerateReasonPlaceholder')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="brackets-regenerate-confirm">
              {t('regenerateConfirmLabel', { token: confirmToken })}
            </Label>
            <Input
              id="brackets-regenerate-confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="h-10 bg-[var(--color-surface)]"
              placeholder={t('regenerateConfirmPlaceholder', { token: confirmToken })}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            className="bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90"
            disabled={pending || !overview || !canSubmit}
            onClick={() => onConfirm({ reason: reason.trim() })}
          >
            {pending ? t('actionRegenerating') : t('actionRegenerate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
