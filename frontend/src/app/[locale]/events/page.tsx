import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { getServerApiUrl } from '@/lib/api';
import type { PublicEvent } from '@/lib/api/public';

// ─── helpers ────────────────────────────────────────────────────────────────

function lifecycleMeta(lc: string): { label: string; cls: string; dot?: boolean } {
  switch (lc) {
    case 'LIVE':
      return {
        label: 'Live now',
        cls: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]',
        dot: true,
      };
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
  const mon = d.toLocaleDateString('en', { month: 'short' });
  const day = d.getDate();
  return { mon, day };
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function PublicEventsPage() {
  const tPublic = await getTranslations('public');
  const locale = await getLocale();

  const url = await getServerApiUrl('/api/public/events');
  const res = await fetch(url, { cache: 'no-store' });
  const events: PublicEvent[] = res.ok ? await res.json() : [];

  // Sort: live first, then by start date desc
  const sorted = [...events].sort((a, b) => {
    if (a.lifecycle === 'LIVE' && b.lifecycle !== 'LIVE') return -1;
    if (b.lifecycle === 'LIVE' && a.lifecycle !== 'LIVE') return 1;
    return new Date(b.competitionStartDate).getTime() - new Date(a.competitionStartDate).getTime();
  });

  const liveEvents = sorted.filter((e) => e.lifecycle === 'LIVE');
  const upcoming = sorted.filter((e) => e.lifecycle !== 'LIVE' && e.lifecycle !== 'COMPLETED');
  const past = sorted.filter((e) => e.lifecycle === 'COMPLETED');

  return (
    <PublicLayout>
      <div className="space-y-10 py-2">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
            {tPublic('eventsTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('eventsSubtitle')}
          </p>
        </div>

        {events.length === 0 && (
          <p className="text-[14px] text-[var(--color-text-muted)]">{tPublic('noEventsYet')}</p>
        )}

        {/* Live */}
        {liveEvents.length > 0 && (
          <Section label="Live now">
            <EventList events={liveEvents} locale={locale} />
          </Section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <Section label="Upcoming">
            <EventList events={upcoming} locale={locale} />
          </Section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <Section label="Past events">
            <EventList events={past} locale={locale} muted />
          </Section>
        )}

      </div>
    </PublicLayout>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </h2>
      {children}
    </section>
  );
}

// ─── EventList ───────────────────────────────────────────────────────────────

function EventList({
  events,
  locale,
  muted = false,
}: {
  events: PublicEvent[];
  locale: string;
  muted?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
      {events.map((event, i) => (
        <EventRow
          key={event.id}
          event={event}
          locale={locale}
          divider={i !== 0}
          muted={muted}
        />
      ))}
    </div>
  );
}

// ─── EventRow ────────────────────────────────────────────────────────────────

function EventRow({
  event,
  locale,
  divider,
  muted,
}: {
  event: PublicEvent;
  locale: string;
  divider: boolean;
  muted: boolean;
}) {
  const { mon, day } = dateBubble(event.competitionStartDate);
  const { label, cls, dot } = lifecycleMeta(event.lifecycle);
  const dateRange = fmtDateRange(event.competitionStartDate, event.competitionEndDate);

  return (
    <Link
      href={`/${locale}/events/${event.slug}`}
      className={`group flex items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-[var(--color-surface-alt)] ${
        divider ? 'border-t border-[var(--color-border)]' : ''
      }`}
    >
      {/* Date bubble */}
      <div className={`flex w-11 shrink-0 flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-border)] py-1.5 transition-colors duration-150 group-hover:border-[var(--color-primary)]/40 ${muted ? 'opacity-50' : ''}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {mon}
        </span>
        <span className="text-[18px] font-bold tabular-nums leading-tight text-[var(--color-text)]">
          {day}
        </span>
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[14px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)] ${muted ? 'opacity-70' : ''}`}>
          {event.name}
        </p>
        <p className={`mt-0.5 text-[12px] text-[var(--color-text-muted)] ${muted ? 'opacity-60' : ''}`}>
          {[event.location, dateRange].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Right: pill + arrow */}
      <div className="flex shrink-0 items-center gap-2">
        <span className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
          {dot && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
            </span>
          )}
          {label}
        </span>
        <svg
          className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-primary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
