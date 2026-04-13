'use client';

import { useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { TopbarToggles } from '@/components/layout/TopbarToggles';

const fadeUp = {
  hidden: { opacity: 0, y: 18, filter: 'blur(4px)' },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

type Props = {
  children: ReactNode;
};

export function LoginShell({ children }: Props) {
  const tApp = useTranslations('app');
  const tAuth = useTranslations('auth');
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* ── Ambient background glows ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-60 -top-40 h-[600px] w-[600px] rounded-full bg-[var(--color-primary)]/8 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-60 h-[500px] w-[500px] rounded-full bg-[var(--color-primary)]/6 blur-[100px]"
      />

      {/* ── Left panel — branding (hidden on small screens) ── */}
      <div className="relative hidden flex-col justify-between border-r border-[var(--color-border)] bg-[var(--color-surface)] p-10 lg:flex lg:w-[46%] xl:w-[42%]">
        {/* Decorative grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-text) 1px, transparent 1px), linear-gradient(90deg, var(--color-text) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Corner accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-px w-1/2 bg-gradient-to-l from-transparent via-[var(--color-primary)]/40 to-transparent"
        />

        {/* Logo */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Link
          href={`/${locale}`}
          className="relative z-10 inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-[13px] font-bold tracking-wide text-white">
            {tApp('badge').slice(0, 2)}
          </span>
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-text)]">{tApp('title')}</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">{tApp('subtitle')}</div>
          </div>
        </Link>
        </motion.div>

        {/* Center content */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="relative z-10 space-y-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary-subtle)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary)]" />
              Georgian Wushu Federation
            </div>
            <h1 className="text-[2.2rem] font-bold leading-[1.15] tracking-tight text-[var(--color-text)]">
              Tournament<br />Management<br />Platform
            </h1>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[var(--color-text-muted)]">
              Real-time draws, brackets, scheduling and live results for competitive wushu events.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['Live scoring', 'Auto brackets', 'Weigh-in tracking', 'Club management'].map((feat, i) => (
              <motion.span
                key={feat}
                custom={2 + i * 0.5}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)]/60 px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-muted)]"
              >
                {feat}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Bottom */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="relative z-10 flex items-center justify-between">
          <Link
            href={`/${locale}/events`}
            className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {tPublic('viewEvents')} →
          </Link>
          <TopbarToggles />
        </motion.div>
      </div>

      {/* ── Right panel — form ── */}
      <div
        className="relative flex flex-1 flex-col"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setSpot(null)}
      >
        {/* Cursor spotlight */}
        {spot && (
          <div
            className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
            style={{
              background: `radial-gradient(500px circle at ${spot.x}px ${spot.y}px, var(--color-primary-subtle), transparent 70%)`,
            }}
          />
        )}
        {/* Mobile topbar */}
        <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 lg:hidden">
          <Link href={`/${locale}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-[11px] font-bold text-white">
              {tApp('badge').slice(0, 2)}
            </span>
            <span className="text-[13px] font-semibold">{tApp('title')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/events`} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              {tPublic('viewEvents')}
            </Link>
            <TopbarToggles />
          </div>
        </header>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <motion.div
            className="w-full max-w-[400px]"
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 150, damping: 25, delay: 0.1 }}
          >
            {/* Card */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
              {/* Card top glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/50 to-transparent"
              />

              {/* Header */}
              <div className="mb-8 space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)]/25 bg-[var(--color-primary-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-primary)]">
                  {tApp('badge')}
                </div>
                <h2 className="text-[22px] font-bold tracking-tight text-[var(--color-text)]">
                  {tAuth('heading')}
                </h2>
                <p className="text-[13px] text-[var(--color-text-muted)]">{tAuth('subtitle')}</p>
              </div>

              {children}
            </div>

            {/* Below-card note */}
            <p className="mt-5 text-center text-[12px] text-[var(--color-text-muted)]">
              {tApp('title')} · {tApp('subtitle')}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
