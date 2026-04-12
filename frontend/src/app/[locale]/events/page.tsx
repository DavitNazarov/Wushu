import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { getServerApiUrl } from '@/lib/api';
import type { PublicEvent } from '@/lib/api/public';

/* ─── helpers ────────────────────────────────────────────────────────────── */

function lifecycleMeta(lc: string): { label: string; cls: string; dot?: boolean } {
  switch (lc) {
    case 'LIVE':
      return { label: 'Live now', cls: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]', dot: true };
    case 'COMPLETED':
      return { label: 'Completed', cls: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]' };
    case 'REG_OPEN':
      return { label: 'Registration open', cls: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' };
    case 'WEIGHIN':
      return { label: 'Weigh-in', cls: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]' };
    case 'PUBLISHED':
      return { label: 'Published', cls: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' };
    case 'DRAWN':
      return { label: 'Draw done', cls: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]' };
    default:
      return { label: lc.replace(/_/g, ' ').toLowerCase(), cls: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]' };
  }
}

function dateBubble(iso: string) {
  const d = new Date(iso);
  return { mon: d.toLocaleDateString('en', { month: 'short' }), day: d.getDate() };
}

function fmtDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default async function PublicEventsPage() {
  const tPublic = await getTranslations('public');
  const locale  = await getLocale();

  const url = await getServerApiUrl('/api/public/events');
  const res = await fetch(url, { cache: 'no-store' });
  const events: PublicEvent[] = res.ok ? await res.json() : [];

  const sorted = [...events].sort((a, b) => {
    if (a.lifecycle === 'LIVE' && b.lifecycle !== 'LIVE') return -1;
    if (b.lifecycle === 'LIVE' && a.lifecycle !== 'LIVE') return 1;
    return new Date(b.competitionStartDate).getTime() - new Date(a.competitionStartDate).getTime();
  });

  const liveEvents = sorted.filter((e) => e.lifecycle === 'LIVE');
  const upcoming   = sorted.filter((e) => e.lifecycle !== 'LIVE' && e.lifecycle !== 'COMPLETED');
  const past       = sorted.filter((e) => e.lifecycle === 'COMPLETED');

  return (
    <PublicLayout>
      <div className="space-y-16 pb-16">

        {/* hero */}
        <section className="relative flex flex-col items-center py-16 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[360px] w-[360px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[90px]" />
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Georgian Wushu Federation
          </p>
          <h1 className="max-w-[540px] text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)]">
            {tPublic('eventsTitle')}
          </h1>
          <p className="mt-4 max-w-[380px] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
            {tPublic('eventsSubtitle')}
          </p>
        </section>

        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-24 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-muted)]">{tPublic('noEventsYet')}</p>
          </div>
        )}

        {liveEvents.length > 0 && (
          <EventSection label="Live now" accentColor="var(--color-success)">
            {liveEvents.map((ev, i) => <EventRow key={ev.id} event={ev} locale={locale} divider={i > 0} />)}
          </EventSection>
        )}

        {upcoming.length > 0 && (
          <EventSection label="Upcoming" accentColor="var(--color-primary)">
            {upcoming.map((ev, i) => <EventRow key={ev.id} event={ev} locale={locale} divider={i > 0} />)}
          </EventSection>
        )}

        {past.length > 0 && (
          <EventSection label="Past events">
            {past.map((ev, i) => <EventRow key={ev.id} event={ev} locale={locale} divider={i > 0} muted />)}
          </EventSection>
        )}

      </div>
    </PublicLayout>
  );
}

/* ─── section ─────────────────────────────────────────────────────────────── */

function EventSection({ label, accentColor, children }: { label: string; accentColor?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        {accentColor && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accentColor }} />}
        <h2
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: accentColor ?? 'var(--color-text-muted)' }}
        >
          {label}
        </h2>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {children}
      </div>
    </section>
  );
}

/* ─── row ─────────────────────────────────────────────────────────────────── */

function EventRow({ event, locale, divider, muted = false }: {
  event: PublicEvent; locale: string; divider: boolean; muted?: boolean;
}) {
  const { mon, day } = dateBubble(event.competitionStartDate);
  const { label, cls, dot } = lifecycleMeta(event.lifecycle);
  const dateRange = fmtDateRange(event.competitionStartDate, event.competitionEndDate);

  return (
    <Link
      href={`/${locale}/events/${event.slug}`}
      className={`group flex items-center gap-5 px-5 py-4 transition-colors duration-150 hover:bg-[var(--color-surface-alt)] ${divider ? 'border-t border-[var(--color-border)]' : ''}`}
    >
      <div className={`flex w-12 shrink-0 flex-col items-center rounded-xl border border-[var(--color-border)] py-2 transition-colors group-hover:border-[var(--color-primary)]/40 ${muted ? 'opacity-40' : ''}`}>
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{mon}</span>
        <span className="text-[20px] font-bold tabular-nums leading-tight text-[var(--color-text)]">{day}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)] ${muted ? 'opacity-60' : ''}`}>
          {event.name}
        </p>
        <p className={`mt-0.5 text-[12px] text-[var(--color-text-muted)] ${muted ? 'opacity-50' : ''}`}>
          {[event.location, dateRange].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
          {dot && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
            </span>
          )}
          {label}
        </span>
        <svg className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
