import { type ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 py-16 px-8 text-center">
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {description && (
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
