'use client';

import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/primitives/button';
import { Checkbox } from '@/components/ui/primitives/checkbox';
import { Label } from '@/components/ui/primitives/label';
import { Textarea } from '@/components/ui/primitives/textarea';
import { EventFormDialog } from '@/features/events/components/EventFormDialog';
import type { EventLifecycle } from '@/types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  currentLifecycle: EventLifecycle;
  nextLifecycle: EventLifecycle | null;
  reason: string;
  onReasonChange: (value: string) => void;
  override: boolean;
  onOverrideChange: (value: boolean) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export function EventAdvanceDialog({
  open,
  onClose,
  currentLifecycle,
  nextLifecycle,
  reason,
  onReasonChange,
  override,
  onOverrideChange,
  isPending,
  onConfirm,
}: Props) {
  const tAdvance = useTranslations('admin.events.advance');
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');

  return (
    <EventFormDialog
      open={open && !!nextLifecycle}
      onClose={onClose}
      title={tAdvance('dialogTitle')}
      description={tAdvance('dialogDescription')}
      contentClassName="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tAdvance('cancel')}
          </Button>
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? tCommon('loading') : tAdvance('confirm')}
          </Button>
        </>
      }
    >
      {nextLifecycle ? (
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
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text)]">
              <Checkbox
                checked={override}
                onCheckedChange={(checked) => onOverrideChange(checked === true)}
              />
              {tCommon('override')}
            </label>
            <div className="space-y-1">
              <Label htmlFor="event-advance-reason">{tAdvance('reasonLabel')}</Label>
              <Textarea
                id="event-advance-reason"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                className="h-20 resize-none"
              />
            </div>
          </div>
        </div>
      ) : null}
    </EventFormDialog>
  );
}
