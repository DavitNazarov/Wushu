'use client';

import { InlineAlert } from '@/components/ui/InlineAlert';
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
  targetPublished: boolean;
  overview: BracketsOverviewResponse | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tCommon: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketPublishDialog({
  open,
  targetPublished,
  overview,
  pending,
  onClose,
  onConfirm,
  t,
  tCommon,
}: Props) {
  const title = targetPublished ? t('publishDialogTitle') : t('unpublishDialogTitle');
  const description = targetPublished
    ? t('publishDialogDescription')
    : t('unpublishDialogDescription');

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-[13px] text-[var(--color-text)]">
          {targetPublished ? (
            <InlineAlert variant="info">{t('publishDialogInfo')}</InlineAlert>
          ) : (
            <InlineAlert variant="warning">{t('unpublishDialogInfo')}</InlineAlert>
          )}

          {overview && (
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-muted)]">
              <li>{t('publishDialogSummaryCategories', { count: overview.summary.categoriesWithBrackets })}</li>
              <li>{t('publishDialogSummaryAthletes', { count: overview.summary.totalAthletesInBrackets })}</li>
              <li>{t('publishDialogSummaryByes', { count: overview.summary.totalByes })}</li>
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending || !overview}
            className={
              targetPublished ? '' : 'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90'
            }
          >
            {pending
              ? targetPublished
                ? t('actionPublishing')
                : t('actionUnpublishing')
              : targetPublished
                ? t('actionPublish')
                : t('actionUnpublish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
