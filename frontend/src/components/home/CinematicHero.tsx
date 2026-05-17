'use client';

import { useRef, useCallback, type PointerEvent } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion';
import { ArrowRight, ChevronDown, Shield, Trophy, Users, Radio } from 'lucide-react';
import { useAuthRole } from '@/hooks/useAuthRole';

/* ─── kinetic headline word ──────────────────────────────────────────────── */

function Word({
  children,
  index,
  total,
  progress,
  reduce,
  delay,
}: {
  children: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  reduce: boolean | null;
  delay: number;
}) {
  // Words fan out at different rates as the hero scrolls away.
  const dir = index - (total - 1) / 2;
  const y = useTransform(progress, [0, 1], [0, -60 - Math.abs(dir) * 36]);
  const x = useTransform(progress, [0, 1], [0, dir * 26]);

  if (reduce) {
    return <span className="inline-block">{children}</span>;
  }

  return (
    <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
      <motion.span
        className="inline-block"
        style={{ y, x }}
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        transition={{ delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* ─── cinematic hero ─────────────────────────────────────────────────────── */

export function CinematicHero() {
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const { role, isLoading } = useAuthRole();
  const reduce = useReducedMotion();

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const contentY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0]);

  const markY = useTransform(scrollYProgress, [0, 1], [0, 170]);
  const markScale = useTransform(scrollYProgress, [0, 1], [1, 1.28]);
  const markRotate = useTransform(scrollYProgress, [0, 1], [0, 14]);
  const markOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);

  // Pointer parallax (desktop fine-pointer only).
  const pxRaw = useMotionValue(0);
  const pyRaw = useMotionValue(0);
  const px = useSpring(pxRaw, { stiffness: 60, damping: 18, mass: 0.4 });
  const py = useSpring(pyRaw, { stiffness: 60, damping: 18, mass: 0.4 });

  const onPointer = useCallback(
    (e: PointerEvent) => {
      if (reduce || e.pointerType !== 'mouse') return;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      pxRaw.set(((e.clientX - r.left) / r.width - 0.5) * 2);
      pyRaw.set(((e.clientY - r.top) / r.height - 0.5) * 2);
    },
    [reduce, pxRaw, pyRaw],
  );
  const onLeave = useCallback(() => {
    pxRaw.set(0);
    pyRaw.set(0);
  }, [pxRaw, pyRaw]);

  const markPX = useTransform(px, (v) => v * 34);
  const markPY = useTransform(py, (v) => v * 34);
  const glowPX = useTransform(px, (v) => v * 64);
  const glowPY = useTransform(py, (v) => v * 64);
  const titlePX = useTransform(px, (v) => v * -12);

  const words = tPublic('heroTitle').split(' ');

  const authHref =
    role === 'admin' ? `/${locale}/admin`
    : role === 'coach' ? `/${locale}/coach`
    : role === 'athlete' ? `/${locale}/athlete`
    : `/${locale}/login`;
  const authLabel =
    role === 'admin' ? tPublic('adminDashboard')
    : role === 'coach' ? tPublic('coachDashboard')
    : role === 'athlete' ? tPublic('athleteProfile')
    : tPublic('adminSignIn');

  return (
    <section
      ref={ref}
      onPointerMove={onPointer}
      onPointerLeave={onLeave}
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden"
      style={{ background: 'var(--color-inverse-surface)' }}
    >
      {/* ── deep background ─────────────────────────────────────────── */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={reduce ? undefined : { x: glowPX, y: glowPY }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
          style={{ background: 'var(--color-primary)', opacity: 0.22 }}
        />
      </motion.div>

      {/* fine grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 70%)',
        }}
      />

      {/* rotating octagon seal */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={reduce ? undefined : { x: markPX, y: markPY }}
      >
        <motion.div
          style={
            reduce
              ? undefined
              : { y: markY, scale: markScale, rotate: markRotate, opacity: markOpacity }
          }
        >
          <svg
            viewBox="0 0 600 600"
            width="min(86vmin, 760px)"
            height="min(86vmin, 760px)"
            fill="none"
          >
            <polygon
              points="220,20 380,20 580,220 580,380 380,580 220,580 20,380 20,220"
              stroke="var(--color-primary)"
              strokeOpacity="0.30"
              strokeWidth="1.5"
            />
            <polygon
              points="240,52 360,52 548,240 548,360 360,548 240,548 52,360 52,240"
              stroke="var(--color-primary)"
              strokeOpacity="0.16"
              strokeWidth="1"
            />
            <circle cx="300" cy="300" r="210" stroke="var(--color-primary)" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="2 12" />
            <circle cx="300" cy="300" r="150" stroke="var(--color-primary)" strokeOpacity="0.10" strokeWidth="1" />
          </svg>
        </motion.div>
      </motion.div>

      {/* bottom fade into the next (light) section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to top, var(--color-bg), transparent)' }}
      />

      {/* ── foreground content ──────────────────────────────────────── */}
      <motion.div
        className="relative z-10 mx-auto max-w-[1100px] px-6 text-center"
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-9 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 backdrop-blur-sm"
        >
          <Shield className="h-3.5 w-3.5 text-[var(--color-primary)]" strokeWidth={2.2} />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
            {tPublic('heroBadge')}
          </span>
        </motion.div>

        <motion.h1
          style={reduce ? undefined : { x: titlePX }}
          className="mx-auto flex max-w-[16ch] flex-wrap justify-center gap-x-[0.28em] gap-y-1 text-[clamp(2.8rem,9vw,7rem)] font-black leading-[0.92] tracking-[-0.03em] text-white"
        >
          {words.map((w, i) => (
            <Word
              key={`${w}-${i}`}
              index={i}
              total={words.length}
              progress={scrollYProgress}
              reduce={reduce}
              delay={0.15 + i * 0.07}
            >
              {w}
            </Word>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mx-auto mt-8 max-w-[540px] text-[17px] leading-relaxed text-white/55 sm:text-[19px]"
        >
          {tPublic('heroSubtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.55 }}
          className="mt-11 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href={`/${locale}/events`}>
            <motion.span
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-full bg-[var(--color-primary)] px-9 py-4 text-[15px] font-bold text-white shadow-[0_12px_48px_-8px_var(--color-primary)]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">{tPublic('viewEvents')}</span>
              <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </motion.span>
          </Link>
          <Link href={authHref}>
            <motion.span
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-9 py-4 text-[15px] font-semibold text-white/85 backdrop-blur-sm transition-colors hover:bg-white/[0.09]"
            >
              {isLoading ? tPublic('adminSignIn') : authLabel}
            </motion.span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.6 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12px] text-white/45"
        >
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3 w-3" style={{ color: 'var(--color-warning)' }} strokeWidth={2.4} />
            <span className="font-bold text-white/80">12+</span>
            {tPublic('statTournaments')}
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-[var(--color-primary)]" strokeWidth={2.4} />
            <span className="font-bold text-white/80">600+</span>
            {tPublic('statAthletes')}
          </span>
          <span className="hidden h-3 w-px bg-white/15 sm:block" />
          <span className="hidden items-center gap-1.5 sm:flex">
            <Radio className="h-3 w-3 text-red-500" strokeWidth={2.4} />
            <span className="font-bold text-white/80">{tPublic('live')}</span>
          </span>
        </motion.div>
      </motion.div>

      {/* scroll cue */}
      <motion.div
        aria-hidden
        className="absolute bottom-7 left-1/2 -translate-x-1/2"
        style={reduce ? undefined : { opacity: cueOpacity }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, 9, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-10 w-6 items-start justify-center rounded-full border border-white/25 p-1.5"
        >
          <ChevronDown className="h-3 w-3 text-white/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
