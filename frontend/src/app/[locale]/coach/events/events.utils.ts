export const ALL_LIFECYCLE = '__all__';

const LIFECYCLE_ACCENT: Record<string, string> = {
  DRAFT: 'border-l-[var(--color-border)]',
  REG_OPEN: 'border-l-[var(--color-success)]',
  LOCKED: 'border-l-[var(--color-warning)]',
  WEIGHIN: 'border-l-[var(--color-warning)]',
  WEIGH_IN_COMPLETED: 'border-l-[var(--color-warning)]',
  DRAWN: 'border-l-[var(--color-info)]',
  PUBLISHED: 'border-l-[var(--color-primary)]',
  ACTIVE: 'border-l-[var(--color-primary)]',
  LIVE: 'border-l-[var(--color-danger)]',
  COMPLETED: 'border-l-emerald-500',
};

export function lifecycleAccent(lifecycle: string): string {
  return LIFECYCLE_ACCENT[lifecycle] ?? 'border-l-[var(--color-border)]';
}
