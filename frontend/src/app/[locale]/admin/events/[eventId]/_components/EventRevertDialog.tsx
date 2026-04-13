'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/primitives/button';
import { Label } from '@/components/ui/primitives/label';
import { Textarea } from '@/components/ui/primitives/textarea';
import { EventFormDialog } from '@/features/events/components/EventFormDialog';
import type { EventLifecycle } from '@/types/api';
import { EVENT_LIFECYCLE_ORDER } from '@/domain/events/lifecycle';

interface Props {
  open: boolean;
  onClose: () => void;
  currentLifecycle: EventLifecycle;
  targetLifecycle: EventLifecycle | null;
  onTargetChange: (stage: EventLifecycle) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export function EventRevertDialog({
  open,
  onClose,
  currentLifecycle,
  targetLifecycle,
  onTargetChange,
  reason,
  onReasonChange,
  isPending,
  onConfirm,
}: Props) {
  const tRevert = useTranslations('admin.events.revert');
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');

  const canConfirm = !!targetLifecycle && reason.trim().length > 0;

  return (
    <EventFormDialog
      open={open}
      onClose={onClose}
      title={tRevert('dialogTitle')}
      description={tRevert('dialogDescription')}
      contentClassName="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            disabled={isPending || !canConfirm}
            onClick={onConfirm}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
          >
            {isPending ? tCommon('loading') : tRevert('confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="flex items-start gap-3 rounded-[var(--radius-input)] border border-amber-500/30 bg-amber-500/8 px-3 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[12px] text-amber-300">{tRevert('warning')}</p>
        </div>

        {/* Current stage */}
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-[var(--color-text-muted)]">{tRevert('currentStage')}</span>
          <StatusChip
            status={currentLifecycle}
            label={tEvents(`lifecycle.${currentLifecycle}`)}
            domain="lifecycle"
          />
        </div>

        {/* Stage picker */}
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{tRevert('targetStage')}</p>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_LIFECYCLE_ORDER.filter((s) => s !== currentLifecycle).map((stage) => {
              const isSelected = stage === targetLifecycle;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => onTargetChange(stage)}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text)]'
                  }`}
                >
                  {tEvents(`lifecycleShort.${stage}` as Parameters<typeof tEvents>[0])}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label htmlFor="event-change-stage-reason">
            {tRevert('reasonLabel')}
            <span className="ml-1 text-[var(--color-danger)]">*</span>
          </Label>
          <Textarea
            id="event-change-stage-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            className="h-20 resize-none"
            placeholder={tRevert('reasonPlaceholder')}
          />
        </div>
      </div>
    </EventFormDialog>
  );
}
