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
      className="flex items-center gap-2 text-[13px] text-[var(--color-text)]"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}
