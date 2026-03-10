'use client';

import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
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
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={pending}>
            {tCommon('cancel')}
          </SecondaryButton>
          <PrimaryButton
            onClick={onConfirm}
            disabled={pending || !overview}
            className={targetPublished ? '' : '!bg-[var(--color-danger)] hover:!opacity-90'}
          >
            {pending
              ? targetPublished
                ? t('actionPublishing')
                : t('actionUnpublishing')
              : targetPublished
                ? t('actionPublish')
                : t('actionUnpublish')}
          </PrimaryButton>
        </>
      }
    >
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
    </Modal>
  );
}
