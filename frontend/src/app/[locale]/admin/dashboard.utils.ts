export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Colours are CSS-variable references (resolved per theme) — never raw hex,
// so the pipeline stays in sync with light/dark tokens like the rest of the UI.
export const PIPELINE_STAGES: { key: string; color: string }[] = [
  { key: 'DRAFT',     color: 'var(--color-text-muted)' },
  { key: 'REG_OPEN',  color: 'var(--color-info)' },
  { key: 'WEIGHIN',   color: 'var(--color-warning)' },
  { key: 'LOCKED',    color: 'var(--color-accent-violet)' },
  { key: 'DRAWN',     color: 'var(--color-accent-pink)' },
  { key: 'PUBLISHED', color: 'var(--color-accent-cyan)' },
  { key: 'LIVE',      color: 'var(--color-success)' },
];
