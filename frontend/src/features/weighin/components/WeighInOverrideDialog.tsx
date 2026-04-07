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
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { Textarea } from '@/components/ui/primitives/textarea';
import type { WeighInCategory, WeighInDecision } from '@/types/weighin';

const OVERRIDE_DECISIONS: WeighInDecision[] = [
  'PASS',
  'ONE_HOUR',
  'MOVED_UP',
  'FAIL',
  'DISQUALIFIED',
];
const EMPTY_CATEGORY_VALUE = '__weighin-override-category-empty__';

type Props = {
  open: boolean;
  categories: WeighInCategory[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    decision: WeighInDecision;
    reason: string;
    nextEventWeightCategoryId?: string;
  }) => void;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export function WeighInOverrideDialog({
  open,
  categories,
  isPending,
  onClose,
  onSubmit,
  t,
}: Props) {
  const [decision, setDecision] = useState<WeighInDecision>('PASS');
  const [reason, setReason] = useState('');
  const [targetCategoryId, setTargetCategoryId] = useState('');

  const requiresCategory = decision === 'MOVED_UP';
  const blocked =
    isPending || !reason.trim() || (requiresCategory && !targetCategoryId);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{t('overrideTitle')}</DialogTitle>
          <DialogDescription>{t('overrideDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label
              htmlFor="weighin-override-decision"
              className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]"
            >
              {t('overrideDecisionLabel')}
            </Label>
            <Select
              value={decision}
              onValueChange={(value) => setDecision(value as WeighInDecision)}
            >
              <SelectTrigger
                id="weighin-override-decision"
                className="h-10 bg-[var(--color-surface)] px-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_DECISIONS.map((row) => (
                  <SelectItem key={row} value={row}>
                    {t(`decisionOption${row}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresCategory && (
            <div className="space-y-1">
              <Label
                htmlFor="weighin-override-category"
                className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]"
              >
                {t('overrideTargetCategoryLabel')}
              </Label>
              <Select
                value={targetCategoryId || EMPTY_CATEGORY_VALUE}
                onValueChange={(value) =>
                  setTargetCategoryId(
                    value === EMPTY_CATEGORY_VALUE ? '' : value,
                  )
                }
              >
                <SelectTrigger
                  id="weighin-override-category"
                  className="h-10 bg-[var(--color-surface)] px-3"
                >
                  <SelectValue placeholder={t('selectMoveCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_CATEGORY_VALUE}>
                    {t('selectMoveCategory')}
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label
              htmlFor="weighin-override-reason"
              className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]"
            >
              {t('overrideReasonLabel')}
            </Label>
            <Textarea
              id="weighin-override-reason"
              rows={3}
              className="min-h-[104px] bg-[var(--color-surface)]"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('overrideReasonPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('overrideCancel')}
          </Button>
          <Button
            disabled={blocked}
            onClick={() =>
              onSubmit({
                decision,
                reason: reason.trim(),
                nextEventWeightCategoryId: requiresCategory
                  ? targetCategoryId
                  : undefined,
              })
            }
          >
            {isPending ? t('actionSaving') : t('overrideApply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
