'use client';

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export function MatSelector({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text-muted)]">Mat</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-32 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
      />
    </div>
  );
}
