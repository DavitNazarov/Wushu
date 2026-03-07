'use client';

import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import type { EventLifecycle } from '@/types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  currentLifecycle: EventLifecycle;
  nextLifecycle: EventLifecycle | null;
  reason: string;
  onReasonChange: (v: string) => void;
  isPending: boolean;
  onConfirm: () => void;
  tAdvance: (key: string) => string;
  tEvents: (key: string) => string;
  tCommon: (key: string) => string;
}

export function EventAdvanceModal({
  open,
  onClose,
  currentLifecycle,
  nextLifecycle,
  reason,
  onReasonChange,
  isPending,
  onConfirm,
  tAdvance,
  tEvents,
  tCommon,
}: Props) {
  return (
    <Modal
      open={open && !!nextLifecycle}
      onClose={onClose}
      title={tAdvance('dialogTitle')}
      description={tAdvance('dialogDescription')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tAdvance('cancel')}</SecondaryButton>
          <PrimaryButton disabled={isPending} onClick={onConfirm}>
            {isPending ? tCommon('loading') : tAdvance('confirm')}
          </PrimaryButton>
        </>
      }
    >
      {nextLifecycle && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--color-text-muted)]">{tAdvance('currentStage')}</span>
            <StatusChip
              status={currentLifecycle}
              label={tEvents(`lifecycle.${currentLifecycle}`)}
              domain="lifecycle"
            />
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--color-text-muted)]">{tAdvance('nextStage')}</span>
            <StatusChip
              status={nextLifecycle}
              label={tEvents(`lifecycle.${nextLifecycle}`)}
              domain="lifecycle"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text)]">
              {tAdvance('reasonLabel')}
            </label>
            <textarea
              className="mt-1 h-20 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
