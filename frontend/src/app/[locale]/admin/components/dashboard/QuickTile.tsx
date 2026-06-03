'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useSpotlight } from './useSpotlight';

type Props = {
  href: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  accent: string;
  delay: number;
};

export function QuickTile({ href, icon: Icon, label, desc, accent, delay }: Props) {
  const { ref, spot, handleMouseMove, handleMouseLeave } = useSpotlight<HTMLAnchorElement>();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
      whileHover={{ y: -2 }}
    >
      <Link
        ref={ref}
        href={href}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group relative flex h-[68px] items-center gap-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 shadow-[var(--shadow-card)] transition-all hover:border-transparent hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
      >
        {spot && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(120px circle at ${spot.x}px ${spot.y}px, ${accent}28, transparent 80%)`,
            }}
          />
        )}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--color-text)]">{label}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">{desc}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 translate-x-0 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100" style={{ color: accent }} />
      </Link>
    </motion.div>
  );
}
