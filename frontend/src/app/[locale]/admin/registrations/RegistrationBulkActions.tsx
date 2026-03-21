'use client';

import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { RowAction } from './registrationStatusActions';

const ACTION_VARIANTS: Record<RowAction, string> = {
  APPROVED:
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
  REJECTED: 'bg-red-600 text-white hover:bg-red-700',
  WITHDRAWN: 'bg-red-600 text-white hover:bg-red-700',
};

interface RegistrationBulkActionsProps {
  counts: Record<RowAction, number>;
  disabled: boolean;
  isPending: boolean;
  t: (key: string) => string;
  onAction: (action: RowAction) => void;
}

export function RegistrationBulkActions({
  counts,
  disabled,
  isPending,
  t,
  onAction,
}: RegistrationBulkActionsProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {t('bulk.title')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('bulk.description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['APPROVED', 'REJECTED', 'WITHDRAWN'] as const).map((action) => {
            const count = counts[action];
            const actionDisabled = disabled || isPending || count === 0;
            const labelKey =
              action === 'APPROVED'
                ? 'actions.approveAll'
                : action === 'REJECTED'
                  ? 'actions.rejectAll'
                  : 'actions.withdrawAll';

            return (
              <button
                key={action}
                type="button"
                disabled={actionDisabled}
                onClick={() => onAction(action)}
                className={`inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${ACTION_VARIANTS[action]}`}
              >
                {t(labelKey)} ({count})
              </button>
            );
          })}
          <SecondaryButton disabled>{t('bulk.scopeFiltered')}</SecondaryButton>
        </div>
      </div>
    </div>
  );
}
