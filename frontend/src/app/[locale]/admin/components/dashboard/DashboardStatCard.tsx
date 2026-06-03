'use client';

import { motion } from 'framer-motion';
import { useSpotlight } from './useSpotlight';

type Props = {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
};

export function DashboardStatCard({ label, value, icon: Icon, accent }: Props) {
  const { ref, spot, handleMouseMove, handleMouseLeave } = useSpotlight<HTMLDivElement>();

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
      transition={{ duration: 0.18 }}
      className="relative flex h-[108px] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
    >
      {spot && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(120px circle at ${spot.x}px ${spot.y}px, ${accent}28, transparent 80%)`,
          }}
        />
      )}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: `${accent}22`, color: accent }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div>
        <p className="text-[24px] font-bold tabular-nums leading-none text-[var(--color-text)]">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      </div>
    </motion.div>
  );
}
