'use client';

import { useId } from 'react';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { cn } from '@/lib/utils';

const EMPTY_OPTION_VALUE = '__admin-filter-empty__';

export type AdminFilterOption = {
  value: string;
  label: string;
};

type Props = {
  label: string;
  value: string;
  emptyLabel: string;
  options: AdminFilterOption[];
  onValueChange: (value: string) => void;
  fallbackLabel?: string;
  className?: string;
};

export function AdminFilterSelect({
  label,
  value,
  emptyLabel,
  options,
  onValueChange,
  fallbackLabel,
  className,
}: Props) {
  const labelId = useId();
  const normalizedValue = value || EMPTY_OPTION_VALUE;
  const resolvedOptions =
    options.some((option) => option.value === value) || !value
      ? options
      : [{ value, label: fallbackLabel ?? value }, ...options];

  return (
    <div className={cn('flex min-w-[12rem] flex-col gap-1', className)}>
      <Label
        id={labelId}
        className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]"
      >
        {label}
      </Label>
      <Select
        value={normalizedValue}
        onValueChange={(nextValue) =>
          onValueChange(nextValue === EMPTY_OPTION_VALUE ? '' : nextValue)
        }
      >
        <SelectTrigger
          aria-labelledby={labelId}
          className="h-10 bg-[var(--color-surface)] px-3"
        >
          <SelectValue placeholder={emptyLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_OPTION_VALUE}>{emptyLabel}</SelectItem>
          {resolvedOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
