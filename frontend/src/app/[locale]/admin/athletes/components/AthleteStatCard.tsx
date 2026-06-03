'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'warning';
  icon: LucideIcon;
  hint: string;
};

export function AthleteStatCard({ label, value, tone = 'neutral', icon: Icon, hint }: StatCardProps) {
  const iconColor = tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-primary)]';
  const valueColor = tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-primary)]';
  return (
    <motion.div
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-shadow"
      whileHover={{ y: -2, boxShadow: '0 6px 24px -6px rgba(0,0,0,0.18)' }}
      transition={{ duration: 0.15 }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-alt)] transition-colors group-hover:bg-[var(--color-primary-subtle)]">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className={`text-[24px] font-bold tabular-nums leading-none tracking-tight ${valueColor}`}>{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]/70">{hint}</p>
      </div>
    </motion.div>
  );
}
