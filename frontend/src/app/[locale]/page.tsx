'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  GitBranch,
  Zap,
  Trophy,
  Globe,
  ChevronRight,
  ChevronLeft,
  Crown,
  Medal,
  Sparkles,
  Flame,
  TrendingUp,
  MapPin,
  Newspaper,
  Users,
  Radio,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuthRole } from '@/hooks/useAuthRole';
import { apiGet } from '@/lib/api/client';
import { localizedFullName, localizedName } from '@/lib/bilingual';

/* ─── types ──────────────────────────────────────────────────────────────── */

type TopAthlete = {
  rank: number;
  id: string;
  firstName: string;
  firstNameKa: string | null;
  lastName: string;
  lastNameKa: string | null;
  sex: 'MALE' | 'FEMALE' | null;
  club: { id: string; name: string; nameKa: string | null; country: string | null } | null;
  wins: number;
  losses: number;
};

type TopClub = {
  rank: number;
  id: string;
  name: string;
  nameKa: string | null;
  city: string | null;
  country: string | null;
  athletes: number;
  wins: number;
  losses: number;
};

type PublicEventRow = {
  id: string;
  name: string;
  nameKa: string | null;
  slug: string;
  location: string | null;
  lifecycle:
    | 'REG_OPEN'
    | 'LOCKED'
    | 'WEIGHIN'
    | 'WEIGH_IN_COMPLETED'
    | 'DRAWN'
    | 'PUBLISHED'
    | 'LIVE'
    | 'COMPLETED';
  competitionStartDate: string;
  competitionEndDate: string;
};

type PublicNewsRow = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  createdAt: string;
  eventId: string | null;
  event: { id: string; name: string; slug: string; location: string | null } | null;
};

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
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setSpot(null)}
      whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7"
    >
      {spot && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(220px circle at ${spot.x}px ${spot.y}px, ${accent}28, transparent 75%)`,
          }}
        />
      )}
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0,
          transition: 'opacity 0.4s',
        }}
      />
      <div
        className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-110"
        style={{ background: `${accent}18`, color: accent }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h3 className="relative mb-2 text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="relative text-[13px] leading-relaxed text-[var(--color-text-muted)]">{desc}</p>
      <div
        className="relative mt-5 flex items-center gap-1 text-[12px] font-semibold opacity-60 transition-all duration-300 group-hover:gap-2 group-hover:opacity-100"
        style={{ color: accent }}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </motion.div>
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

/* ─── top athlete card ───────────────────────────────────────────────────── */

const RANK_PALETTE: Record<number, { accent: string; icon: React.ElementType; label: string }> = {
  1: { accent: '#f5b301', icon: Crown, label: 'Champion' },
  2: { accent: '#9aa6b2', icon: Medal, label: '2nd' },
  3: { accent: '#cd7f32', icon: Medal, label: '3rd' },
  4: { accent: 'var(--color-primary)' as unknown as string, icon: TrendingUp, label: '4th' },
  5: { accent: 'var(--color-primary)' as unknown as string, icon: TrendingUp, label: '5th' },
};

function TopAthleteRow({ a, idx, locale }: { a: TopAthlete; idx: number; locale: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const palette = RANK_PALETTE[a.rank] ?? RANK_PALETTE[5];
  const RankIcon = palette.icon;
  const fullName = localizedFullName(a.firstName, a.lastName, a.firstNameKa, a.lastNameKa, locale);
  const initials = `${a.firstName[0] ?? ''}${a.lastName[0] ?? ''}`.toUpperCase();
  const clubName = a.club ? localizedName(a.club.name, a.club.nameKa, locale) : null;
  const tPublic = useTranslations('public');

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: idx * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/${locale}/athletes/${a.id}`} className="block">
        <motion.div
          ref={ref as never}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setSpot(null)}
          whileHover={{ y: -4 }}
          className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-primary)]/40"
        >
          {spot && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(260px circle at ${spot.x}px ${spot.y}px, ${palette.accent}26, transparent 70%)`,
              }}
            />
          )}

          {/* rank ribbon */}
          <div
            className="pointer-events-none absolute -left-12 top-3 -rotate-45 px-12 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white opacity-80"
            style={{ background: palette.accent }}
          >
            #{a.rank}
          </div>

          <div className="relative flex items-center gap-5">
            {/* avatar */}
            <div className="relative">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-[18px] font-bold text-white shadow-lg transition-transform duration-500 group-hover:rotate-[-4deg] group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${palette.accent}, var(--color-primary))`,
                }}
              >
                {initials || '?'}
              </div>
              <div
                className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-surface)]"
                style={{ background: palette.accent }}
              >
                <RankIcon className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
              </div>
            </div>

            {/* name + club */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                {fullName}
              </p>
              <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">
                {clubName ?? tPublic('topAthletesUnattached')}
              </p>
            </div>

            {/* record */}
            <div className="hidden shrink-0 items-center gap-5 sm:flex">
              <div className="text-center">
                <p className="text-[20px] font-bold tabular-nums leading-none text-[var(--color-text)]">{a.wins}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('topAthletesWins')}
                </p>
              </div>
              <div className="h-8 w-px bg-[var(--color-border)]" />
              <div className="text-center">
                <p className="text-[20px] font-bold tabular-nums leading-none text-[var(--color-text-muted)]">{a.losses}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('topAthletesLosses')}
                </p>
              </div>
            </div>

            {/* arrow */}
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-primary)]"
            />
          </div>

          {/* mobile record */}
          <div className="relative mt-4 flex items-center gap-4 sm:hidden">
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface-alt)] px-3 py-1">
              <Flame className="h-3 w-3" style={{ color: palette.accent }} />
              <span className="text-[11px] font-semibold tabular-nums text-[var(--color-text)]">
                {a.wins} {tPublic('topAthletesWins')}
              </span>
            </div>
            <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
              {a.losses} {tPublic('topAthletesLosses')}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

/* ─── full-bleed animated hero backdrop ──────────────────────────────────── */
/*
 * Sits behind the hero with `100vw` width via negative left/right margins so
 * the gradient mesh extends edge-to-edge, with no hard section borders. Mouse
 * parallax + slowly drifting blobs + a soft top/bottom fade-out merge it
 * cleanly into the page background.
 */
function HeroBackdrop() {
  const reduce = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const x = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const y = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    if (reduce) return;
    const handler = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseX.set((e.clientX - cx) / 28);
      mouseY.set((e.clientY - cy) / 28);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [mouseX, mouseY, reduce]);

  const x2 = useTransform(x, (v) => -v * 0.6);
  const y2 = useTransform(y, (v) => -v * 0.6);
  const x3 = useTransform(x, (v) => v * 0.35);
  const y3 = useTransform(y, (v) => v * 0.35);

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

      {/* drifting blobs */}
      <motion.div
        style={{ x, y }}
        animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
        transition={reduce ? undefined : { duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary)] opacity-[0.10] blur-[140px]"
      />
      <motion.div
        style={{ x: x2, y: y2 }}
        animate={reduce ? undefined : { scale: [1, 1.12, 1] }}
        transition={reduce ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-[8%] top-[12%] h-[320px] w-[320px] rounded-full bg-[#f5b301] opacity-[0.08] blur-[110px]"
      />
      <motion.div
        style={{ x: x3, y: y3 }}
        animate={reduce ? undefined : { scale: [1, 1.18, 1] }}
        transition={reduce ? undefined : { duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        className="absolute bottom-[8%] left-[10%] h-[260px] w-[260px] rounded-full bg-[#8b5cf6] opacity-[0.08] blur-[100px]"
      />

      {/* slow conic shimmer */}
      <motion.div
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 60, repeat: Infinity, ease: 'linear' }}
        className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0deg, var(--color-primary) 60deg, transparent 120deg, transparent 240deg, #f5b301 300deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
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

      {/* top + bottom feather so the section blends into the page bg */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background:
            'linear-gradient(to bottom, var(--color-bg) 0%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            'linear-gradient(to top, var(--color-bg) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}

/* ─── floating particles ─────────────────────────────────────────────────── */

function HeroParticles({ count = 14 }: { count?: number }) {
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

/* ─── event status helpers ───────────────────────────────────────────────── */

const UPCOMING_LIFECYCLES = new Set([
  'REG_OPEN',
  'LOCKED',
  'WEIGHIN',
  'WEIGH_IN_COMPLETED',
  'DRAWN',
  'PUBLISHED',
]);

function eventGroup(e: PublicEventRow): 'live' | 'upcoming' | 'completed' {
  if (e.lifecycle === 'LIVE') return 'live';
  if (e.lifecycle === 'COMPLETED') return 'completed';
  return 'upcoming';
}

function sortHomeEvents(rows: PublicEventRow[]): PublicEventRow[] {
  const score = (e: PublicEventRow) =>
    e.lifecycle === 'LIVE' ? 0 : UPCOMING_LIFECYCLES.has(e.lifecycle) ? 1 : 2;
  return [...rows].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    const ta = new Date(a.competitionStartDate).getTime();
    const tb = new Date(b.competitionStartDate).getTime();
    return sa === 2 ? tb - ta : ta - tb;
  });
}

function formatDateRange(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const fmtFull: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (sameDay) return s.toLocaleDateString(locale, fmtFull);
  return `${s.toLocaleDateString(locale, fmt)} – ${e.toLocaleDateString(locale, fmtFull)}`;
}

function useCountdown(target: string): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `${minutes}m`;
}

/* ─── event card ─────────────────────────────────────────────────────────── */

function EventCard({
  e,
  idx,
  locale,
}: {
  e: PublicEventRow;
  idx: number;
  locale: string;
}) {
  const tPublic = useTranslations('public');
  const ref = useRef<HTMLAnchorElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const group = eventGroup(e);
  const countdown = useCountdown(e.competitionStartDate);

  const palette =
    group === 'live'
      ? { accent: '#ef4444', icon: Radio, label: tPublic('eventsHomeLive') }
      : group === 'upcoming'
      ? { accent: 'var(--color-primary)', icon: CalendarDays, label: tPublic('eventsHomeUpcoming') }
      : { accent: '#10b981', icon: CheckCircle2, label: tPublic('eventsHomeCompleted') };
  const PaletteIcon = palette.icon;

  const name = localizedName(e.name, e.nameKa, locale);
  const dateLine = formatDateRange(e.competitionStartDate, e.competitionEndDate, locale);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: idx * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/${locale}/events/${e.slug}`} className="block h-full">
        <motion.div
          ref={ref as never}
          onMouseMove={(ev) => {
            const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            setSpot({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
          }}
          onMouseLeave={() => setSpot(null)}
          whileHover={{ y: -6 }}
          className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-primary)]/40"
        >
          {spot && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(260px circle at ${spot.x}px ${spot.y}px, ${palette.accent}26, transparent 70%)`,
              }}
            />
          )}

          {/* status pill */}
          <div className="relative mb-4 flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                background: `${palette.accent}1a`,
                color: palette.accent,
              }}
            >
              {group === 'live' ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ background: palette.accent }}
                  />
                  <span
                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                    style={{ background: palette.accent }}
                  />
                </span>
              ) : (
                <PaletteIcon className="h-3 w-3" strokeWidth={2.4} />
              )}
              {palette.label}
            </span>

            {group === 'upcoming' && countdown && (
              <span className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-[10px] font-bold tabular-nums uppercase tracking-wider text-[var(--color-text)]">
                {tPublic('eventsHomeStartingIn', { value: countdown })}
              </span>
            )}
          </div>

          <h3 className="relative mb-2 text-[18px] font-bold leading-snug tracking-tight text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
            {name}
          </h3>

          <div className="relative mt-auto space-y-2 pt-3">
            <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{dateLine}</span>
            </div>
            {e.location && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{e.location}</span>
              </div>
            )}
          </div>

          <div className="relative mt-4 flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)] opacity-0 transition-all duration-300 group-hover:opacity-100">
            <span>{tPublic('eventsHomeViewAll')}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

/* ─── club row ───────────────────────────────────────────────────────────── */

function TopClubRow({ c, idx, locale }: { c: TopClub; idx: number; locale: string }) {
  const tPublic = useTranslations('public');
  const ref = useRef<HTMLAnchorElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const palette = RANK_PALETTE[c.rank] ?? RANK_PALETTE[5];
  const RankIcon = palette.icon;
  const name = localizedName(c.name, c.nameKa, locale);
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: idx * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/${locale}/clubs/${c.id}`} className="block">
        <motion.div
          ref={ref as never}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setSpot(null)}
          whileHover={{ y: -4 }}
          className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-primary)]/40"
        >
          {spot && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(260px circle at ${spot.x}px ${spot.y}px, ${palette.accent}26, transparent 70%)`,
              }}
            />
          )}

          <div
            className="pointer-events-none absolute -left-12 top-3 -rotate-45 px-12 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white opacity-80"
            style={{ background: palette.accent }}
          >
            #{c.rank}
          </div>

          <div className="relative flex items-center gap-5">
            <div className="relative">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-[16px] font-bold text-white shadow-lg transition-transform duration-500 group-hover:rotate-[-4deg] group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${palette.accent}, var(--color-primary))`,
                }}
              >
                {initials || '?'}
              </div>
              <div
                className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-surface)]"
                style={{ background: palette.accent }}
              >
                <RankIcon className="h-3.5 w-3.5 text-white" strokeWidth={2.4} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                {name}
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[12px] text-[var(--color-text-muted)]">
                {c.city && <MapPin className="h-3 w-3 shrink-0" />}
                {[c.city, c.country].filter(Boolean).join(', ') || '—'}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-5 sm:flex">
              <div className="text-center">
                <p className="text-[20px] font-bold tabular-nums leading-none text-[var(--color-text)]">{c.wins}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('clubsHomeWins')}
                </p>
              </div>
              <div className="h-8 w-px bg-[var(--color-border)]" />
              <div className="text-center">
                <p className="text-[20px] font-bold tabular-nums leading-none text-[var(--color-text-muted)]">{c.athletes}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {tPublic('clubsHomeAthletes')}
                </p>
              </div>
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-primary)]" />
          </div>

          <div className="relative mt-4 flex items-center gap-3 sm:hidden">
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface-alt)] px-3 py-1">
              <Flame className="h-3 w-3" style={{ color: palette.accent }} />
              <span className="text-[11px] font-semibold tabular-nums text-[var(--color-text)]">
                {c.wins} {tPublic('clubsHomeWins')}
              </span>
            </div>
            <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
              {c.athletes} {tPublic('clubsHomeAthletes')}
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

/* ─── news carousel ──────────────────────────────────────────────────────── */

function NewsCarousel({ rows, locale }: { rows: PublicNewsRow[]; locale: string }) {
  const tPublic = useTranslations('public');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-news-card]');
    const step = card ? card.offsetWidth + 16 : 320;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0"
      >
        {rows.map((n, idx) => {
          const dateStr = (n.publishedAt ?? n.createdAt).slice(0, 10);
          return (
            <motion.div
              key={n.id}
              data-news-card
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: idx * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-[300px] shrink-0 snap-start sm:w-[340px]"
            >
              <Link href={`/${locale}/news/${n.slug}`} className="block h-full">
                <motion.div
                  whileHover={{ y: -6 }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-primary)]/40"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.12]" />
                  <div className="relative mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/12 text-[var(--color-primary)] transition-transform duration-500 group-hover:rotate-[6deg] group-hover:scale-110">
                    <Newspaper className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <p className="relative mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    {dateStr}
                  </p>
                  <h3 className="relative mb-3 line-clamp-3 text-[16px] font-bold leading-snug tracking-tight text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                    {n.title}
                  </h3>
                  {n.event && (
                    <p className="relative mt-auto truncate text-[12px] text-[var(--color-text-muted)]">
                      {n.event.name}
                    </p>
                  )}
                  <div className="relative mt-4 flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)] opacity-60 transition-all duration-300 group-hover:gap-2 group-hover:opacity-100">
                    <span>{tPublic('readMore')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </div>
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

  const features = [
    { icon: Calendar,  title: tPublic('featureLiveSchedule'),   desc: tPublic('featureLiveScheduleDesc'),    accent: '#3b82f6' },
    { icon: GitBranch, title: tPublic('featureBracketsResults'), desc: tPublic('featureBracketsResultsDesc'), accent: '#8b5cf6' },
    { icon: Zap,       title: tPublic('featureFastOps'),         desc: tPublic('featureFastOpsDesc'),         accent: '#f59e0b' },
  ];

  // Live leaderboard — refetches every 30s so new wins surface quickly,
  // and on window focus so users see the latest results when they tab back.
  const topAthletesQuery = useQuery({
    queryKey: ['public', 'top-athletes'],
    queryFn: () => apiGet<TopAthlete[]>('/api/public/athletes/top'),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const topClubsQuery = useQuery({
    queryKey: ['public', 'top-clubs'],
    queryFn: () => apiGet<TopClub[]>('/api/public/clubs/top'),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const eventsQuery = useQuery({
    queryKey: ['public', 'events'],
    queryFn: () => apiGet<PublicEventRow[]>('/api/public/events'),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const featuredEvents = eventsQuery.data ? sortHomeEvents(eventsQuery.data).slice(0, 3) : [];

  const newsQuery = useQuery({
    queryKey: ['public', 'news'],
    queryFn: () => apiGet<PublicNewsRow[]>('/api/public/news'),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const newsRows = newsQuery.data ?? [];

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
                backgroundImage:
                  'radial-gradient(var(--color-text) 1px, transparent 1px)',
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

        {/* ── TOP 5 ATHLETES ────────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10 flex flex-col items-center text-center"
          >
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-3.5 py-1">
              <Sparkles className="h-3 w-3 text-[var(--color-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                {tPublic('topAthletesEyebrow')}
              </span>
            </span>
            <h2 className="text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold tracking-tight text-[var(--color-text)]">
              {tPublic('topAthletesTitle')}
            </h2>
            <p className="mt-3 max-w-[460px] text-[14px] text-[var(--color-text-muted)]">
              {tPublic('topAthletesSubtitle')}
            </p>
          </motion.div>

          <div className="space-y-3">
            {topAthletesQuery.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[96px] animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              ))}

            {!topAthletesQuery.isLoading && (topAthletesQuery.data?.length ?? 0) === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center"
              >
                <Trophy className="mb-3 h-10 w-10 text-[var(--color-text-muted)] opacity-40" strokeWidth={1.2} />
                <p className="max-w-[360px] text-[13px] text-[var(--color-text-muted)]">
                  {tPublic('topAthletesEmpty')}
                </p>
              </motion.div>
            )}

            {topAthletesQuery.data?.map((a, idx) => (
              <TopAthleteRow key={a.id} a={a} idx={idx} locale={locale} />
            ))}
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className="mb-12 text-center"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              {tPublic('platformEyebrow')}
            </p>
            <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold tracking-tight text-[var(--color-text)]">
              {tPublic('platformTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-[420px] text-[14px] text-[var(--color-text-muted)]">
              {tPublic('platformSubtitle')}
            </p>
          </motion.div>
          <div className="grid gap-5 sm:grid-cols-3">
            {features.map((f, i) => (
              <SpotCard key={f.title} {...f} delay={i * 0.1} />
            ))}
          </div>
        </section>

        {/* ── FEATURED EVENTS ───────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10 flex flex-col items-center text-center"
          >
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-3.5 py-1">
              <CalendarDays className="h-3 w-3 text-[var(--color-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                {tPublic('eventsEyebrow')}
              </span>
            </span>
            <h2 className="text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold tracking-tight text-[var(--color-text)]">
              {tPublic('eventsHomeTitle')}
            </h2>
            <p className="mt-3 max-w-[460px] text-[14px] text-[var(--color-text-muted)]">
              {tPublic('eventsHomeSubtitle')}
            </p>
          </motion.div>

          {eventsQuery.isLoading && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[200px] animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              ))}
            </div>
          )}

          {!eventsQuery.isLoading && featuredEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center"
            >
              <Calendar className="mb-3 h-10 w-10 text-[var(--color-text-muted)] opacity-40" strokeWidth={1.2} />
              <p className="max-w-[360px] text-[13px] text-[var(--color-text-muted)]">
                {tPublic('eventsHomeEmpty')}
              </p>
            </motion.div>
          )}

          {featuredEvents.length > 0 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featuredEvents.map((e, idx) => (
                  <EventCard key={e.id} e={e} idx={idx} locale={locale} />
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="mt-8 flex justify-center"
              >
                <Link href={`/${locale}/events`}>
                  <span className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:gap-2.5">
                    {tPublic('eventsHomeViewAll')}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            </>
          )}
        </section>

        {/* ── TOP 5 CLUBS ───────────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10 flex flex-col items-center text-center"
          >
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-3.5 py-1">
              <Users className="h-3 w-3 text-[var(--color-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                {tPublic('clubsEyebrow')}
              </span>
            </span>
            <h2 className="text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold tracking-tight text-[var(--color-text)]">
              {tPublic('clubsHomeTitle')}
            </h2>
            <p className="mt-3 max-w-[460px] text-[14px] text-[var(--color-text-muted)]">
              {tPublic('clubsHomeSubtitle')}
            </p>
          </motion.div>

          <div className="space-y-3">
            {topClubsQuery.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[96px] animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              ))}

            {topClubsQuery.data?.map((c, idx) => (
              <TopClubRow key={c.id} c={c} idx={idx} locale={locale} />
            ))}
          </div>

          {(topClubsQuery.data?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mt-8 flex justify-center"
            >
              <Link href={`/${locale}/clubs`}>
                <span className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:gap-2.5">
                  {tPublic('clubsHomeViewAll')}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.div>
          )}
        </section>

        {/* ── LATEST NEWS ───────────────────────────────────────────── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 flex flex-col items-center text-center"
          >
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8 px-3.5 py-1">
              <Newspaper className="h-3 w-3 text-[var(--color-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                {tPublic('newsEyebrow')}
              </span>
            </span>
            <h2 className="text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold tracking-tight text-[var(--color-text)]">
              {tPublic('newsHomeTitle')}
            </h2>
            <p className="mt-3 max-w-[460px] text-[14px] text-[var(--color-text-muted)]">
              {tPublic('newsHomeSubtitle')}
            </p>
          </motion.div>

          {newsQuery.isLoading && (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[220px] w-[320px] shrink-0 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              ))}
            </div>
          )}

          {!newsQuery.isLoading && newsRows.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center"
            >
              <Newspaper className="mb-3 h-10 w-10 text-[var(--color-text-muted)] opacity-40" strokeWidth={1.2} />
              <p className="max-w-[360px] text-[13px] text-[var(--color-text-muted)]">
                {tPublic('newsHomeEmpty')}
              </p>
            </motion.div>
          )}

          {newsRows.length > 0 && (
            <>
              <NewsCarousel rows={newsRows} locale={locale} />
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="mt-4 flex justify-center"
              >
                <Link href={`/${locale}/news`}>
                  <span className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] transition hover:gap-2.5">
                    {tPublic('newsHomeViewAll')}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            </>
          )}
        </section>

        {/* ── CTA BANNER ────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl bg-[var(--color-primary)] px-8 py-16 text-center text-white"
        >
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white opacity-[0.06] blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white opacity-[0.06] blur-3xl"
          />
          <div className="relative">
            <div className="mb-3 flex items-center justify-center gap-2 opacity-60">
              <Globe className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                {tPublic('ctaEyebrow')}
              </span>
            </div>
            <h2 className="mb-4 text-[clamp(1.7rem,4vw,2.6rem)] font-extrabold tracking-tight">
              {tPublic('ctaTitle')}
            </h2>
            <p className="mx-auto mb-9 max-w-[440px] text-[15px] leading-relaxed opacity-75">
              {tPublic('ctaSubtitle')}
            </p>
            <Link href={`/${locale}/events`}>
              <motion.span
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="group relative inline-flex cursor-pointer items-center gap-2 overflow-hidden rounded-full bg-white px-8 py-3.5 text-[14px] font-bold text-[var(--color-primary)] shadow-xl"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--color-primary)]/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">{tPublic('viewEvents')}</span>
                <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </motion.span>
            </Link>
          </div>
        </motion.section>

      </div>
    </PublicLayout>
  );
}
