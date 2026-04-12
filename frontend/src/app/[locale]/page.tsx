'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, GitBranch, Zap, Trophy, Globe, ChevronRight } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuthRole } from '@/hooks/useAuthRole';

/* ─── spotlight card ─────────────────────────────────────────────────────── */

function SpotCard({
  icon: Icon,
  title,
  desc,
  accent,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  accent: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setSpot(null)}
      whileHover={{ y: -4 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7"
    >
      {spot && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(180px circle at ${spot.x}px ${spot.y}px, ${accent}22, transparent 75%)`,
          }}
        />
      )}
      <div
        className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: `${accent}18`, color: accent }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">{desc}</p>
      <div className="mt-5 flex items-center gap-1 text-[12px] font-semibold" style={{ color: accent }}>
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </motion.div>
  );
}

/* ─── stat ───────────────────────────────────────────────────────────────── */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <p className="text-[40px] font-bold tabular-nums leading-none text-[var(--color-text)]">{value}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
    </motion.div>
  );
}

/* ─── step ───────────────────────────────────────────────────────────────── */

function Step({ n, label, last }: { n: number; label: string; last?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: n * 0.08, duration: 0.4 }}
      className="flex items-center gap-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[13px] font-bold text-white shadow-[0_0_0_5px_var(--color-primary-subtle)]">
        {n}
      </div>
      <span className="text-[14px] font-medium text-[var(--color-text)]">{label}</span>
      {!last && <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] opacity-30" />}
    </motion.div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default function PublicHomePage() {
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const { role, isLoading } = useAuthRole();

  const heroAuthHref =
    role === 'admin' ? `/${locale}/admin`
    : role === 'coach' ? `/${locale}/coach`
    : role === 'athlete' ? `/${locale}/athlete`
    : `/${locale}/login`;

  const heroAuthLabel =
    role === 'admin' ? tPublic('adminDashboard')
    : role === 'coach' ? tPublic('coachDashboard')
    : role === 'athlete' ? tPublic('athleteProfile')
    : tPublic('adminSignIn');

  const features = [
    { icon: Calendar,  title: tPublic('featureLiveSchedule'),   desc: tPublic('featureLiveScheduleDesc'),    accent: '#3b82f6' },
    { icon: GitBranch, title: tPublic('featureBracketsResults'), desc: tPublic('featureBracketsResultsDesc'), accent: '#8b5cf6' },
    { icon: Zap,       title: tPublic('featureFastOps'),         desc: tPublic('featureFastOpsDesc'),         accent: '#f59e0b' },
  ];

  return (
    <PublicLayout>
      <div className="space-y-28 pb-16">

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className="relative flex min-h-[72vh] flex-col items-center justify-center py-20 text-center">
          {/* ambient glow */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[500px] w-[500px] rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-[110px]" />
          </div>

          {/* badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-4 py-1.5"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Georgian Wushu Federation
            </span>
          </motion.div>

          {/* headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="max-w-[700px] text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--color-text)]"
          >
            {tPublic('heroTitle')}
          </motion.h1>

          {/* subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-6 max-w-[480px] text-[17px] leading-relaxed text-[var(--color-text-muted)]"
          >
            {tPublic('heroSubtitle')}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.45 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href={`/${locale}/events`}>
              <motion.span
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--color-primary)] px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_4px_24px_var(--color-primary-hover)] transition"
              >
                {tPublic('viewEvents')}
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
            </Link>
            <Link href={heroAuthHref}>
              <motion.span
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-7 py-3.5 text-[14px] font-semibold text-[var(--color-text)] transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
              >
                {isLoading ? tPublic('adminSignIn') : heroAuthLabel}
              </motion.span>
            </Link>
          </motion.div>

          {/* scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          >
            <div className="flex h-8 w-5 items-start justify-center rounded-full border border-[var(--color-border)] p-1">
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                className="h-1.5 w-1 rounded-full bg-[var(--color-text-muted)] opacity-50"
              />
            </div>
          </motion.div>
        </section>

        {/* ── STATS ─────────────────────────────────────────────────── */}
        <section>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-12">
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
              <Stat value="12+" label="Tournaments run" />
              <Stat value="600+" label="Athletes registered" />
              <Stat value="40+" label="Clubs competing" />
              <Stat value="2k+" label="Fights recorded" />
            </div>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Platform
            </p>
            <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold tracking-tight text-[var(--color-text)]">
              Everything in one place
            </h2>
            <p className="mx-auto mt-3 max-w-[400px] text-[14px] text-[var(--color-text-muted)]">
              From registration and weigh-in to live brackets and real-time results.
            </p>
          </motion.div>
          <div className="grid gap-5 sm:grid-cols-3">
            {features.map((f, i) => (
              <SpotCard key={f.title} {...f} delay={i * 0.1} />
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
        <section className="grid gap-14 md:grid-cols-2 md:items-center">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]"
            >
              {tPublic('howItWorksTitle')}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10 text-[clamp(1.5rem,3vw,2.2rem)] font-bold leading-tight tracking-tight text-[var(--color-text)]"
            >
              From sign-up to podium in four steps
            </motion.h2>
            <div className="flex flex-col gap-6">
              <Step n={1} label={tPublic('howItWorksStep1')} />
              <Step n={2} label={tPublic('howItWorksStep2')} />
              <Step n={3} label={tPublic('howItWorksStep3')} />
              <Step n={4} label={tPublic('howItWorksStep4')} last />
            </div>
          </div>

          {/* decorative panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative hidden md:block"
          >
            <div className="relative flex h-[340px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.035]"
                style={{
                  backgroundImage: 'linear-gradient(var(--color-text) 1px, transparent 1px), linear-gradient(90deg, var(--color-text) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                }}
              />
              <div className="absolute h-52 w-52 rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
              <Trophy className="relative h-24 w-24 text-[var(--color-primary)] opacity-20" strokeWidth={0.8} />
            </div>
          </motion.div>
        </section>

        {/* ── CTA BANNER ────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-[var(--color-primary)] px-8 py-16 text-center text-white"
        >
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white opacity-[0.06] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white opacity-[0.06] blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-center gap-2 opacity-60">
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Georgian Wushu Federation</span>
            </div>
            <h2 className="mb-4 text-[clamp(1.7rem,4vw,2.6rem)] font-extrabold tracking-tight">
              Ready to compete?
            </h2>
            <p className="mx-auto mb-9 max-w-[420px] text-[15px] leading-relaxed opacity-75">
              Browse upcoming events, check brackets, and follow live results — all in real time.
            </p>
            <Link href={`/${locale}/events`}>
              <motion.span
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-8 py-3.5 text-[14px] font-bold text-[var(--color-primary)] shadow-xl"
              >
                {tPublic('viewEvents')}
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
            </Link>
          </div>
        </motion.section>

      </div>
    </PublicLayout>
  );
}
