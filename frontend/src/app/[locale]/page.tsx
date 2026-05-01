'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuthRole } from '@/hooks/useAuthRole';

/* ─── lazy below-fold sections ───────────────────────────────────────────── */

const HomePageSections = dynamic(() => import('./HomePageSections'), {
  ssr: false,
  loading: () => (
    <div className="space-y-32">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        />
      ))}
    </div>
  ),
});

/* ─── animated count-up ──────────────────────────────────────────────────── */

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !seen) setSeen(true);
      },
      { threshold: 0.4 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    const duration = 1500;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [seen, value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

/* ─── stat ───────────────────────────────────────────────────────────────── */

function Stat({ value, suffix, label, idx }: { value: number; suffix?: string; label: string; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.55, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group text-center"
    >
      <p className="text-[44px] font-bold tabular-nums leading-none text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
        <CountUp value={value} suffix={suffix} />
      </p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
    </motion.div>
  );
}

/* ─── hero backdrop ──────────────────────────────────────────────────────── */

function HeroBackdrop() {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 overflow-hidden"
      style={{
        left: '50%',
        right: '50%',
        marginLeft: '-50vw',
        marginRight: '-50vw',
        width: '100vw',
      }}
    >
      {/* base ambient gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, var(--color-primary-subtle) 0%, transparent 55%)',
          opacity: 0.55,
        }}
      />

      {/* blobs — CSS keyframe animations so they never touch the JS thread */}
      <div
        className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary)] opacity-[0.09] blur-[90px]"
        style={reduce ? undefined : { animation: 'hero-pulse-a 12s ease-in-out infinite' }}
      />
      <div
        className="absolute right-[8%] top-[12%] h-[280px] w-[280px] rounded-full bg-[#f5b301] opacity-[0.07] blur-[70px]"
        style={reduce ? undefined : { animation: 'hero-pulse-b 9s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-[8%] left-[10%] h-[220px] w-[220px] rounded-full bg-[#8b5cf6] opacity-[0.07] blur-[60px]"
        style={reduce ? undefined : { animation: 'hero-pulse-c 11s ease-in-out infinite 1.2s' }}
      />

      {/* slow conic shimmer — CSS animation, not Framer Motion */}
      <div
        className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0deg, var(--color-primary) 60deg, transparent 120deg, transparent 240deg, #f5b301 300deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
          ...(reduce ? undefined : { animation: 'hero-spin 60s linear infinite' }),
        }}
      />

      {/* fine grain dots */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(var(--color-text) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* top + bottom feather */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{ background: 'linear-gradient(to bottom, var(--color-bg) 0%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to top, var(--color-bg) 0%, transparent 100%)' }}
      />
    </div>
  );
}

/* ─── floating particles ─────────────────────────────────────────────────── */

function HeroParticles({ count = 8 }: { count?: number }) {
  const reduce = useReducedMotion();
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; size: number; duration: number; delay: number }[]
  >([]);

  useEffect(() => {
    if (reduce) return;
    setParticles(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 6 + Math.random() * 8,
        delay: Math.random() * 4,
      })),
    );
  }, [count, reduce]);

  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-[var(--color-primary)]"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default function PublicHomePage() {
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const { role, isLoading } = useAuthRole();

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);

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

  return (
    <PublicLayout>
      <div className="space-y-32 pb-16">

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <motion.section
          ref={heroRef}
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative flex min-h-[78vh] flex-col items-center justify-center py-20 text-center"
        >
          <HeroBackdrop />
          <HeroParticles />

          {/* badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-4 py-1.5 backdrop-blur-sm"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              {tPublic('heroBadge')}
            </span>
          </motion.div>

          {/* headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-[760px] text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.06] tracking-tight text-[var(--color-text)]"
          >
            {tPublic('heroTitle')}
          </motion.h1>

          {/* subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.5 }}
            className="relative mt-6 max-w-[500px] text-[17px] leading-relaxed text-[var(--color-text-muted)]"
          >
            {tPublic('heroSubtitle')}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.45 }}
            className="relative mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href={`/${locale}/events`}>
              <motion.span
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="group relative inline-flex cursor-pointer items-center gap-2 overflow-hidden rounded-full bg-[var(--color-primary)] px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_4px_24px_var(--color-primary-hover)] transition"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">{tPublic('viewEvents')}</span>
                <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
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
        </motion.section>

        {/* ── STATS ─────────────────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-14"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'radial-gradient(var(--color-text) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            />
            <div className="relative grid grid-cols-2 gap-10 sm:grid-cols-4">
              <Stat idx={0} value={12} suffix="+" label={tPublic('statTournaments')} />
              <Stat idx={1} value={600} suffix="+" label={tPublic('statAthletes')} />
              <Stat idx={2} value={40} suffix="+" label={tPublic('statClubs')} />
              <Stat idx={3} value={2000} suffix="+" label={tPublic('statFights')} />
            </div>
          </motion.div>
        </section>

        {/* ── below-fold sections (lazy) ─────────────────────────────── */}
        <HomePageSections />

      </div>
    </PublicLayout>
  );
}
