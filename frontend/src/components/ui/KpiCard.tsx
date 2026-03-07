import { type ReactNode } from 'react';

type KpiCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  color?: string;
};

export function KpiCard({ label, value, icon, trend, color }: KpiCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      {icon && (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: color ? `${color}20` : 'var(--color-primary-subtle)', color: color ?? 'var(--color-primary)' }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
          {value}
        </p>
        {trend && (
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{trend}</p>
        )}
      </div>
    </div>
  );
}
