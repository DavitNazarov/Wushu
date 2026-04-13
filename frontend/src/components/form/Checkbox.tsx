'use client';

import { Checkbox as RadixCheckbox } from '@/components/ui/primitives/checkbox';

type CheckboxProps = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
};

export function Checkbox({ id, checked, onCheckedChange, label, disabled }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-text)]"
    >
      <RadixCheckbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(val) => onCheckedChange(val === true)}
      />
      {label}
    </label>
  );
}
