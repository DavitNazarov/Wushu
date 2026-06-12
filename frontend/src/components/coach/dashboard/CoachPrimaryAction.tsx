'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, CalendarCheck, CalendarClock, CalendarX, CheckCircle2, ClipboardList, UserPlus } from 'lucide-react';
import { localizedName } from '@/lib/bilingual';
import type { DashboardUpcomingEvent } from './types';

type Props = {
  events: DashboardUpcomingEvent[];
  totalAthletes: number;
};

/**
 * The single most important thing on the coach dashboard.
 *
 * A coach's job is to register athletes, so this picks the one event that most
 * needs their attention and renders one big, unmistakable next step. Everything
 * else on the page is secondary. "Open for registration" means the event is in
 * the REG_OPEN stage (the same thing the public site shows) — the registration
 * window then decides whether the coach can act now. The card adapts to:
 *   1. No athletes yet            → "Add your first athlete" (no roster, nothing to register)
 *   2. REG_OPEN + window open      → "Register athletes for <event>" with progress + deadline
 *   3. REG_OPEN + window not open  → surface the event with "opens on…/closed" (never hidden)
 *   4. No REG_OPEN event at all    → a calm "you're up to date" state
 */
export function CoachPrimaryAction({ events, totalAthletes }: Props) {
  const t = useTranslations('coach.dashboard.primaryAction');
  const locale = useLocale();
  const addAthleteHref = `/${locale}/coach/athletes`;
  const browseEventsHref = `/${locale}/coach/events`;

  // 1 — Roster is empty: the real first step is adding athletes.
  if (totalAthletes === 0) {
    return (
      <PromptCard
        icon={UserPlus}
        accent="var(--color-primary)"
        title={t('noAthletesTitle')}
        subtitle={t('noAthletesSubtitle')}
        href={addAthleteHref}
        cta={t('noAthletesButton')}
        emphasis="primary"
      />
    );
  }

  const featured = pickFeaturedEvent(events);

  // 4 — No event is in the registration stage right now.
  if (!featured) {
    return (
      <PromptCard
        icon={CalendarCheck}
        accent="var(--color-primary)"
        title={t('noOpenTitle')}
        subtitle={t('noOpenSubtitle')}
        href={browseEventsHref}
        cta={t('noOpenButton')}
        emphasis="secondary"
      />
    );
  }

  // 3 — Stage is REG_OPEN but the registration window is not open yet (or has
  // closed). Surface the event honestly instead of letting it disappear.
  if (featured.registrationStatus !== 'OPEN') {
    return <PendingRegistrationCard event={featured} />;
  }

  // 2 — Registration is genuinely open: the main "register athletes" path.
  const registered = Math.max(0, totalAthletes - featured.availableAthletesCount);
  const pct = totalAthletes > 0 ? Math.round((registered / totalAthletes) * 100) : 0;
  const allDone = featured.availableAthletesCount === 0;
  const days = daysUntil(featured.registrationClosesAt);
  const showDeadline = !allDone && days !== null && days >= 0 && days <= 14;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-primary)]/30 bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ background: 'radial-gradient(600px circle at 100% 0%, var(--color-primary), transparent 60%)' }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--color-success) 14%, transparent)', color: 'var(--color-success)' }}
          >
            {allDone ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <CalendarCheck className="h-4 w-4" aria-hidden />}
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-success)]">
            {allDone ? t('allSetEyebrow') : t('openEventEyebrow')}
          </span>
        </div>

        <div>
          <h2 className="text-[22px] font-bold leading-tight text-[var(--color-text)] sm:text-[26px]">
            {allDone ? t('allSetHeading') : t('registerHeading')}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text)]">
            <span className="font-semibold">{localizedName(featured.name, featured.nameKa, locale)}</span>
            <span className="text-[var(--color-text-muted)]">
              {' · '}
              {formatRange(featured.competitionStartDate, featured.competitionEndDate, locale)}
              {featured.location ? ` · ${featured.location}` : ''}
            </span>
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-medium text-[var(--color-text)]">{t('progress', { registered, total: totalAthletes })}</span>
            <span className="tabular-nums text-[var(--color-text-muted)]">{pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: 'var(--color-success)' }}
            />
          </div>
        </div>

        {showDeadline && (
          <p className="text-[13px] font-medium text-[var(--color-warning)]">
            {days === 0 ? t('closesToday') : t('closesIn', { days: days ?? 0 })}
          </p>
        )}

        <Link
          href={featured.href}
          className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-7 text-[16px] font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] sm:w-auto sm:self-start"
        >
          <ClipboardList className="h-5 w-5" aria-hidden />
          {allDone ? t('reviewButton') : t('registerButton')}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- prompt variants */

function PromptCard({
  icon: Icon,
  accent,
  title,
  subtitle,
  href,
  cta,
  emphasis,
}: {
  icon: typeof UserPlus;
  accent: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  emphasis: 'primary' | 'secondary';
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
        >
          <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold text-[var(--color-text)] sm:text-[20px]">{title}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-text-muted)]">{subtitle}</p>
          {emphasis === 'primary' ? (
            <Link
              href={href}
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-6 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
            >
              {cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <Link
              href={href}
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-[var(--radius-input)] border border-[var(--color-border)] px-5 text-[14px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              {cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Stage is REG_OPEN but the coach can't add registrations yet — the window is
 * either upcoming or closed. Surface the event with an honest status so it is
 * never silently missing from the dashboard (and a bad window date is visible).
 */
function PendingRegistrationCard({ event }: { event: DashboardUpcomingEvent }) {
  const t = useTranslations('coach.dashboard.primaryAction');
  const locale = useLocale();
  const upcoming = event.registrationStatus === 'UPCOMING';
  const accent = upcoming ? 'var(--color-warning)' : 'var(--color-danger)';

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
          >
            {upcoming ? <CalendarClock className="h-4 w-4" aria-hidden /> : <CalendarX className="h-4 w-4" aria-hidden />}
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
            {upcoming ? t('opensSoonEyebrow') : t('closedEyebrow')}
          </span>
        </div>

        <div>
          <h2 className="text-[20px] font-bold leading-tight text-[var(--color-text)] sm:text-[22px]">
            {localizedName(event.name, event.nameKa, locale)}
          </h2>
          <p className="mt-1.5 text-[14px] text-[var(--color-text-muted)]">
            {formatRange(event.competitionStartDate, event.competitionEndDate, locale)}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        </div>

        <p className="text-[14px] font-medium" style={{ color: accent }}>
          {upcoming && event.registrationOpensAt
            ? t('opensOnLabel', { date: formatDate(event.registrationOpensAt, locale) })
            : t('closedNote')}
        </p>

        <Link
          href={event.href}
          className="inline-flex h-11 items-center gap-2 self-start rounded-[var(--radius-input)] border border-[var(--color-border)] px-5 text-[14px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {t('viewEventButton')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- helpers */

/**
 * Pick the registration-stage event that most needs the coach. Registration is
 * only possible in the REG_OPEN stage, so that — not the date-window status — is
 * what makes an event "open for registration" (matching the public site). The
 * window status only refines the ranking so the most actionable event wins.
 */
function pickFeaturedEvent(events: DashboardUpcomingEvent[]): DashboardUpcomingEvent | null {
  const regStage = events.filter((event) => event.lifecycle === 'REG_OPEN');
  if (regStage.length === 0) return null;
  return [...regStage].sort((a, b) => actionRank(a) - actionRank(b) || deadlineTime(a) - deadlineTime(b))[0];
}

/** Lower = more actionable for the coach right now. */
function actionRank(event: DashboardUpcomingEvent): number {
  const windowOpen = event.registrationStatus === 'OPEN';
  if (windowOpen && event.availableAthletesCount > 0) return 0; // can register + has work
  if (windowOpen) return 1; // can register, everyone done
  if (event.registrationStatus === 'UPCOMING') return 2; // opens soon
  return 3; // window closed but stage still open
}

function deadlineTime(event: DashboardUpcomingEvent): number {
  return new Date(event.registrationClosesAt ?? event.competitionStartDate).getTime();
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function formatRange(start: string, end: string, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const startLabel = new Date(start).toLocaleDateString(locale, opts);
  const endLabel = new Date(end).toLocaleDateString(locale, opts);
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}
