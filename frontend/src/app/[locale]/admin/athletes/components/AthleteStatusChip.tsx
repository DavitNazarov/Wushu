export type StatusChipProps = { label: string; tone: 'neutral' | 'warning' | 'muted' };

export function AthleteStatusChip({ label, tone }: StatusChipProps) {
  const cls =
    tone === 'warning' ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
    : tone === 'muted'  ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
    :                     'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}
