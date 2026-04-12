'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

type KpiCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  color?: string;
};

export function KpiCard({ label, value, icon, trend, color }: KpiCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
    >
      {icon && (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
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
    </motion.div>
  );
}
