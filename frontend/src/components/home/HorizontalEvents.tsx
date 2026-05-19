'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  MapPin,
  Radio,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { localizedName } from '@/lib/bilingual';

type PublicEventRow = {
  id: string;
  name: string;
  nameKa: string | null;
  slug: string;
  location: string | null;
  lifecycle:
    | 'REG_OPEN' | 'LOCKED' | 'WEIGHIN' | 'WEIGH_IN_COMPLETED'
    | 'DRAWN' | 'PUBLISHED' | 'LIVE' | 'COMPLETED';
  competitionStartDate: string;
  competitionEndDate: string;
};

const UPCOMING = new Set([
  'REG_OPEN', 'LOCKED', 'WEIGHIN', 'WEIGH_IN_COMPLETED', 'DRAWN', 'PUBLISHED',
]);

function group(e: PublicEventRow): 'live' | 'upcoming' | 'completed' {
  if (e.lifecycle === 'LIVE') return 'live';
  if (e.lifecycle === 'COMPLETED') return 'completed';
  return 'upcoming';
}

function sortEvents(rows: PublicEventRow[]): PublicEventRow[] {
  const score = (e: PublicEventRow) =>
    e.lifecycle === 'LIVE' ? 0 : UPCOMING.has(e.lifecycle) ? 1 : 2;
  return [...rows].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    const ta = new Date(a.competitionStartDate).getTime();
    const tb = new Date(b.competitionStartDate).getTime();
    return sa === 2 ? tb - ta : ta - tb;
  });
}

function dateRange(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const full: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (s.toDateString() === e.toDateString()) return s.toLocaleDateString(locale, full);
  return `${s.toLocaleDateString(locale, fmt)} – ${e.toLocaleDateString(locale, full)}`;
}

/* ─── one cinematic event card ───────────────────────────────────────────── */

function EventCard({ e, locale, n }: { e: PublicEventRow; locale: string; n: number }) {
  const tPublic = useTranslations('public');
  const g = group(e);
  const palette =
    g === 'live'
      ? {
          accent: 'var(--color-danger)',
          soft: 'var(--color-danger-subtle)',
          Icon: Radio,
          label: tPublic('eventsHomeLive'),
        }
      : g === 'upcoming'
        ? {
            accent: 'var(--color-primary)',
            soft: 'var(--color-primary-subtle)',
            Icon: CalendarDays,
            label: tPublic('eventsHomeUpcoming'),
          }
        : {
            accent: 'var(--color-success)',
            soft: 'var(--color-success-subtle)',
            Icon: CheckCircle2,
            label: tPublic('eventsHomeCompleted'),
          };
  const name = localizedName(e.name, e.nameKa, locale);

  return (
    <Link href={`/${locale}/events/${e.slug}`} className="block h-full">
      <motion.div
        whileHover={{ y: -8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="group relative flex h-full w-[78vw] flex-col justify-between overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:w-[460px] sm:p-10 lg:w-[520px]"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: palette.accent, opacity: 0.1 }}
        />
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: palette.accent }} />

        <div className="relative flex items-start justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ background: palette.soft, color: palette.accent }}
          >
            <palette.Icon className="h-3 w-3" strokeWidth={2.4} />
            {palette.label}
          </span>
          <span
            className="text-[clamp(3rem,7vw,5rem)] font-black leading-none tracking-tighter text-[var(--color-text)] opacity-[0.06]"
            aria-hidden
          >
            {String(n + 1).padStart(2, '0')}
          </span>
        </div>

        <div className="relative">
          <h3 className="mb-5 text-[clamp(1.6rem,3vw,2.6rem)] font-black leading-[1.05] tracking-tight text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
            {name}
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-[14px] text-[var(--color-text-muted)]">
              <Calendar className="h-4 w-4 shrink-0" />
              {dateRange(e.competitionStartDate, e.competitionEndDate, locale)}
            </div>
            {e.location && (
              <div className="flex items-center gap-2.5 text-[14px] text-[var(--color-text-muted)]">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{e.location}</span>
              </div>
            )}
          </div>
          <div className="mt-7 inline-flex items-center gap-2 text-[13px] font-bold text-[var(--color-primary)]">
            {tPublic('eventDetail')}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/* ─── section heading ────────────────────────────────────────────────────── */

function Heading() {
  const tPublic = useTranslations('public');
  return (
    <div className="mx-auto max-w-[1100px] px-6 text-center">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.32em] text-[var(--color-primary)]">
        {tPublic('eventsEyebrow')}
      </p>
      <h2 className="text-[clamp(1.8rem,4.2vw,3rem)] font-black tracking-tight text-[var(--color-text)]">
        {tPublic('eventsHomeTitle')}
      </h2>
      <p className="mx-auto mt-4 max-w-[460px] text-[14px] leading-relaxed text-[var(--color-text-muted)]">
        {tPublic('eventsHomeSubtitle')}
      </p>
    </div>
  );
}

/* ─── horizontal pinned track ────────────────────────────────────────────── */

export function HorizontalEvents() {
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const reduce = useReducedMotion();

  const q = useQuery({
    queryKey: ['public', 'events'],
    queryFn: () => apiGet<PublicEventRow[]>('/api/public/events'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const events = q.data ? sortEvents(q.data).slice(0, 8) : [];

  const outerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const maxX = useRef(0);
  const [pinHeight, setPinHeight] = useState(0);
  const [wide, setWide] = useState(false);

  // Decide pinning from a stable signal (viewport width + reduced-motion +
  // enough cards) — NOT from cross-layout DOM measurement. This avoids the
  // observer-attached-to-the-wrong-element and flip-flop bugs.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const canPin = !reduce && wide && events.length >= 3;

  const barRef = useRef<HTMLDivElement>(null);

  // Single source of truth: one `recompute` derives the track overflow ONCE
  // and uses it for BOTH the pin height (sticky room) and the scrub progress,
  // so they can never disagree (the cause of early-saturation). It writes the
  // transforms to the DOM directly (no Framer MotionValue / rAF batching) so
  // the scrub is synchronous with scroll and not affected by tab throttling.
  useEffect(() => {
    if (!canPin) {
      maxX.current = 0;
      setPinHeight(0);
      if (trackRef.current) trackRef.current.style.transform = '';
      if (barRef.current) barRef.current.style.transform = '';
      return;
    }
    // Cached element top — refreshed only when layout can actually change
    // (mount / resize / track-size), never read on the scroll path.
    let start = 0;

    // Scroll path: pure arithmetic + two compositor-only transform writes.
    // No getBoundingClientRect / scrollWidth reads and no setState here, so
    // scrolling triggers zero forced reflow. Stays synchronous (no rAF) so
    // the scrub still tracks scroll exactly and survives tab throttling.
    const apply = () => {
      const tk = trackRef.current;
      if (!tk) return;
      const overflow = maxX.current;
      if (overflow <= 0) {
        tk.style.transform = 'translate3d(0,0,0)';
        if (barRef.current) barRef.current.style.transform = 'scaleX(0)';
        return;
      }
      const p = Math.min(1, Math.max(0, (window.scrollY - start) / overflow));
      tk.style.transform = `translate3d(${-p * overflow}px,0,0)`;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    };

    // Measure path: the only place that reads layout (forces reflow once).
    const measure = () => {
      const el = outerRef.current;
      const vp = viewportRef.current;
      const tk = trackRef.current;
      if (!el || !vp || !tk) return;
      const overflow = Math.max(0, tk.scrollWidth - vp.clientWidth);
      maxX.current = overflow;
      setPinHeight(overflow > 0 ? window.innerHeight + overflow : 0);
      start = el.getBoundingClientRect().top + window.scrollY;
      apply();
    };

    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 250);
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [canPin, events.length]);

  const cards =
    events.length > 0 ? (
      events.map((e, i) => (
        <div key={e.id} className="shrink-0">
          <EventCard e={e} locale={locale} n={i} />
        </div>
      ))
    ) : q.isLoading ? (
      Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[340px] w-[78vw] shrink-0 animate-pulse rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] sm:w-[460px] lg:w-[520px]"
        />
      ))
    ) : (
      <div className="flex w-full items-center justify-center rounded-[28px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-16 text-center text-[14px] text-[var(--color-text-muted)]">
        {tPublic('eventsHomeEmpty')}
      </div>
    );

  // outerRef is ALWAYS rendered so useScroll's target stays bound; only the
  // inner content switches between the pinned track and the swipe fallback.
  return (
    <div
      ref={outerRef}
      style={canPin ? { height: pinHeight || undefined } : undefined}
      className="relative"
    >
      {canPin ? (
        <div
          ref={viewportRef}
          className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden"
        >
          <div className="pt-[9vh]">
            <Heading />
          </div>

          <div
            ref={trackRef}
            style={{ transform: 'translate3d(0,0,0)' }}
            className="mt-12 flex items-stretch gap-7 px-[6vw] will-change-transform"
          >
            {cards}
            <div className="flex w-[60vw] shrink-0 items-center sm:w-[420px]">
              <Link href={`/${locale}/events`} className="group">
                <span className="inline-flex items-center gap-3 text-[clamp(1.2rem,2.4vw,2rem)] font-black tracking-tight text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                  {tPublic('eventsHomeViewAll')}
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-white transition-transform duration-300 group-hover:translate-x-1.5">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </span>
              </Link>
            </div>
          </div>

          {/* horizontal progress */}
          <div className="mx-auto mt-12 h-px w-[min(560px,70vw)] bg-[var(--color-border)]">
            <div
              ref={barRef}
              className="h-full origin-left bg-[var(--color-primary)]"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </div>
      ) : (
        <section className="py-24">
          <Heading />
          <div className="mt-14">
            <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {events.length > 0
                ? events.map((e, i) => (
                    <div key={e.id} className="h-[340px] shrink-0 snap-start">
                      <EventCard e={e} locale={locale} n={i} />
                    </div>
                  ))
                : cards}
            </div>
          </div>
          <div className="mt-10 flex justify-center">
            <Link href={`/${locale}/events`}>
              <span className="group inline-flex items-center gap-2 text-[13px] font-bold text-[var(--color-primary)]">
                {tPublic('eventsHomeViewAll')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
