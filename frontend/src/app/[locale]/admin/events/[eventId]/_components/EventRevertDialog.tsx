'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/primitives/button';
import { Label } from '@/components/ui/primitives/label';
import { Textarea } from '@/components/ui/primitives/textarea';
import { EventFormDialog } from '@/features/events/components/EventFormDialog';
import type { EventLifecycle } from '@/types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  currentLifecycle: EventLifecycle;
  previousLifecycle: EventLifecycle | null;
  reason: string;
  onReasonChange: (value: string) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export function EventRevertDialog({
  open,
  onClose,
  currentLifecycle,
  previousLifecycle,
  reason,
  onReasonChange,
  isPending,
  onConfirm,
}: Props) {
  const tRevert = useTranslations('admin.events.revert');
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');

  const canConfirm = reason.trim().length > 0;

  return (
    <EventFormDialog
      open={open && !!previousLifecycle}
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
            className="bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 text-white"
          >
            {isPending ? tCommon('loading') : tRevert('confirm')}
          </Button>
        </>
      }
    >
      {previousLifecycle ? (
        <div className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-[var(--radius-input)] border border-amber-500/30 bg-amber-500/8 px-3 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-[12px] text-amber-300">{tRevert('warning')}</p>
          </div>

          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--color-text-muted)]">{tRevert('currentStage')}</span>
            <StatusChip
              status={currentLifecycle}
              label={tEvents(`lifecycle.${currentLifecycle}`)}
              domain="lifecycle"
            />
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--color-text-muted)]">{tRevert('targetStage')}</span>
            <StatusChip
              status={previousLifecycle}
              label={tEvents(`lifecycle.${previousLifecycle}`)}
              domain="lifecycle"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-revert-reason">
              {tRevert('reasonLabel')}
              <span className="ml-1 text-[var(--color-danger)]">*</span>
            </Label>
            <Textarea
              id="event-revert-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              className="h-20 resize-none"
              placeholder={tRevert('reasonPlaceholder')}
            />
          </div>
        </div>
      ) : null}
    </EventFormDialog>
  );
}
