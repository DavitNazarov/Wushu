'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap, Globe, Users, Mail } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';

/* ─── spotlight value card ───────────────────────────────────────────────── */

function ValueCard({
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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.45 }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setSpot(null)}
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
    >
      {spot && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(160px circle at ${spot.x}px ${spot.y}px, ${accent}20, transparent 75%)`,
          }}
        />
      )}
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `${accent}18`, color: accent }}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
      </div>
      <h3 className="mb-1.5 text-[14px] font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">{desc}</p>
    </motion.div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default function AboutPage() {
  const tPublic = useTranslations('public');
  const locale = useLocale();

  const values = [
    {
      icon: Shield,
      title: 'Auditable',
      desc: 'Every action — from weigh-in to draw — is logged for full accountability.',
      accent: '#3b82f6',
    },
    {
      icon: Zap,
      title: 'Fast',
      desc: 'Weigh-in, draw, scheduling, and live results run in minutes, not hours.',
      accent: '#f59e0b',
    },
    {
      icon: Globe,
      title: 'Open',
      desc: 'Spectators and athletes see live brackets and results without an account.',
      accent: '#8b5cf6',
    },
    {
      icon: Users,
      title: 'Multi-club',
      desc: 'Designed for federations running events across many clubs and weight classes.',
      accent: '#22c55e',
    },
  ];

  return (
    <PublicLayout>
      <div className="space-y-24 pb-16">

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <section className="relative flex min-h-[52vh] flex-col items-center justify-center py-20 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[440px] w-[440px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[100px]" />
          </div>

          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]"
          >
            About us
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55 }}
            className="max-w-[620px] text-[clamp(2rem,5.5vw,3.6rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)]"
          >
            {tPublic('aboutTitle')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-[var(--color-text-muted)]"
          >
            {tPublic('aboutMissionText')}
          </motion.p>
        </section>

        {/* ── PULL QUOTE ────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-surface)] px-10 py-12 text-center"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-3xl" />
          <p className="relative mx-auto max-w-[680px] text-[clamp(1.1rem,2.5vw,1.45rem)] font-medium leading-relaxed text-[var(--color-text)]">
            "{tPublic('aboutWhatItDoesText')}"
          </p>
        </motion.section>

        {/* ── MISSION ───────────────────────────────────────────────── */}
        <section className="grid gap-14 md:grid-cols-2 md:items-center">
          {/* decorative grid panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="relative hidden md:block"
          >
            <div className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.035]"
                style={{
                  backgroundImage: 'linear-gradient(var(--color-text) 1px, transparent 1px), linear-gradient(90deg, var(--color-text) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                }}
              />
              <div className="absolute h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl" />
              <Globe className="relative h-20 w-20 text-[var(--color-primary)] opacity-20" strokeWidth={0.8} />
            </div>
          </motion.div>

          <div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]"
            >
              {tPublic('aboutMission')}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-5 text-[clamp(1.4rem,3vw,2rem)] font-bold leading-tight tracking-tight text-[var(--color-text)]"
            >
              Built for Georgian wushu — by the federation, for everyone.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-[14px] leading-relaxed text-[var(--color-text-muted)]"
            >
              {tPublic('aboutMissionText')}
            </motion.p>
          </div>
        </section>

        {/* ── VALUES ────────────────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Our principles
            </p>
            <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] font-bold tracking-tight text-[var(--color-text)]">
              What we stand for
            </h2>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {values.map((v, i) => (
              <ValueCard key={v.title} {...v} delay={i * 0.08} />
            ))}
          </div>
        </section>

        {/* ── CONTACT CTA ───────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-[var(--color-primary)] px-8 py-14 text-white"
        >
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white opacity-[0.06] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white opacity-[0.06] blur-3xl" />

          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 opacity-60">
                <Mail className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                  {tPublic('aboutContact')}
                </span>
              </div>
              <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-extrabold tracking-tight">
                Get in touch
              </h2>
              <p className="mt-2 max-w-[400px] text-[14px] leading-relaxed opacity-75">
                {tPublic('aboutContactText')}
              </p>
            </div>
            <Link href={`/${locale}/contact`} className="shrink-0">
              <motion.span
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-bold text-[var(--color-primary)] shadow-xl whitespace-nowrap"
              >
                {tPublic('contact')}
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
            </Link>
          </div>
        </motion.section>

      </div>
    </PublicLayout>
  );
}
