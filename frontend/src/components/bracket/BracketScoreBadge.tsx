'use client';

type Props = {
  score: string | null;
  winMethod: string | null;
};

export function BracketScoreBadge({ score, winMethod }: Props) {
  const value = score ?? winMethod;
  if (!value) return null;

  return (
    <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
      {value}
    </span>
  );
}
