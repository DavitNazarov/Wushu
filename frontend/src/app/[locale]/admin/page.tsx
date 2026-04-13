'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  FileText,
  Scale,
  Shuffle,
  Trophy,
  Radio,
  Users,
  GitBranch,
  Clock,
  MapPin,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { apiGet } from '@/lib/api/client';
import { adminVariants } from '@/lib/animations/variants';
import type { EventRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

/* ─── tiny helpers ─────────────────────────────────────────────────────────── */

const LIFECYCLE_ORDER = ['REG_OPEN', 'WEIGHIN', 'LOCKED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED', 'DRAFT'] as const;

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── animated KPI card ────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setSpot(null)}
      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
      transition={{ duration: 0.18 }}
      className="relative flex h-[108px] flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
    >
      {/* cursor spotlight */}
      {spot && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(120px circle at ${spot.x}px ${spot.y}px, ${accent}28, transparent 80%)`,
          }}
        />
      )}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: `${accent}22`, color: accent }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div>
        <p className="text-[24px] font-bold tabular-nums leading-none text-[var(--color-text)]">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      </div>
    </motion.div>
  );
}

/* ─── live now banner ──────────────────────────────────────────────────────── */

function LiveBanner({ events, locale, t }: { events: EventRow[]; locale: string; t: (k: string) => string }) {
  if (!events.length) return null;
  const ev = events[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-success)]/40 bg-[var(--color-success)]/8 px-4 py-3"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-success)]" />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-semibold text-[var(--color-success)]">{t('liveNow')}: </span>
        <span className="text-[13px] font-medium text-[var(--color-text)]">{ev.name}</span>
        {ev.location && (
          <span className="ml-2 text-[12px] text-[var(--color-text-muted)]">
            <MapPin className="mb-0.5 mr-0.5 inline h-3 w-3" />
            {ev.location}
          </span>
        )}
      </div>
      <Link
        href={`/${locale}/admin/events/${ev.id}/live`}
        className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-success)] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
      >
        <Radio className="h-3 w-3" />
        {t('liveGoTo')}
      </Link>
    </motion.div>
  );
}

/* ─── event pipeline ───────────────────────────────────────────────────────── */

const PIPELINE_STAGES: { key: string; color: string }[] = [
  { key: 'DRAFT',     color: '#6b7280' },
  { key: 'REG_OPEN',  color: '#3b82f6' },
  { key: 'WEIGHIN',   color: '#f59e0b' },
  { key: 'LOCKED',    color: '#8b5cf6' },
  { key: 'DRAWN',     color: '#ec4899' },
  { key: 'PUBLISHED', color: '#06b6d4' },
  { key: 'LIVE',      color: '#22c55e' },
];

function EventPipeline({
  events,
  tEvents,
}: {
  events: EventRow[];
  tEvents: (k: string) => string;
}) {
  const byStage = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    events: events.filter((e) => e.lifecycle === stage.key),
  })).filter((s) => s.events.length > 0);

  if (!byStage.length) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {byStage.map((stage, i) => (
        <motion.div
          key={stage.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="min-w-[160px] flex-shrink-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: stage.color }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: stage.color }}>
              {tEvents(`lifecycle.${stage.key}`)}
            </span>
          </div>
          <div className="space-y-1">
            {stage.events.map((ev) => (
              <p key={ev.id} className="truncate text-[12px] font-medium text-[var(--color-text)]">
                {ev.name}
              </p>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── upcoming countdown card ──────────────────────────────────────────────── */

function NextEventCountdown({ events, locale, t }: { events: EventRow[]; locale: string; t: (k: string) => string }) {
  const upcoming = events
    .filter((e) => !['LIVE', 'COMPLETED'].includes(e.lifecycle))
    .sort((a, b) => new Date(a.competitionStartDate).getTime() - new Date(b.competitionStartDate).getTime());

  const next = upcoming[0];
  if (!next) return null;

  const days = daysUntil(next.competitionStartDate);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
        <span className="text-[22px] font-bold leading-none tabular-nums">{days > 0 ? days : 0}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{t('days')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('nextEvent')}
        </p>
        <p className="truncate text-[15px] font-semibold text-[var(--color-text)]">{next.name}</p>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {next.location && <><MapPin className="mb-0.5 mr-0.5 inline h-3 w-3" />{next.location} · </>}
          {formatDate(next.competitionStartDate)}
        </p>
      </div>
      <Link href={`/${locale}/admin/events`}>
        <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]" />
      </Link>
    </motion.div>
  );
}

/* ─── quick action tile ────────────────────────────────────────────────────── */

function QuickTile({
  href,
  icon: Icon,
  label,
  desc,
  accent,
  delay,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  accent: string;
  delay: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
      whileHover={{ y: -2 }}
    >
      <Link
        ref={ref}
        href={href}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setSpot(null)}
        className="group relative flex h-[68px] items-center gap-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 shadow-[var(--shadow-card)] transition-all hover:border-transparent hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
      >
        {spot && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(120px circle at ${spot.x}px ${spot.y}px, ${accent}28, transparent 80%)`,
            }}
          />
        )}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--color-text)]">{label}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">{desc}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 translate-x-0 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100" style={{ color: accent }} />
      </Link>
    </motion.div>
  );
}

/* ─── event list ────────────────────────────────────────────────────────────── */

function EventListRow({
  ev,
  locale,
  tEvents,
}: {
  ev: EventRow;
  locale: string;
  tEvents: (k: string) => string;
}) {
  const days = daysUntil(ev.competitionStartDate);
  return (
    <motion.div
      variants={adminVariants.staggerChild}
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-3 transition-colors first:border-t-0 hover:bg-[var(--color-surface-alt)]"
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/${locale}/admin/events`}
          className="text-[13px] font-medium text-[var(--color-text)] hover:underline"
        >
          {ev.name}
        </Link>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {ev.location ? `${ev.location} · ` : ''}
          {formatDate(ev.competitionStartDate)}
          {days > 0 && days < 30 && (
            <span className="ml-2 font-semibold text-[var(--color-primary)]">in {days}d</span>
          )}
        </p>
      </div>
      <StatusChip
        status={ev.lifecycle}
        label={tEvents(`lifecycle.${ev.lifecycle}`)}
        domain="lifecycle"
      />
    </motion.div>
  );
}

/* ─── main page ─────────────────────────────────────────────────────────────── */

export default function AdminDashboardPage() {
  const t = useTranslations('admin.dashboard');
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
    staleTime: 30_000,
  });

  const liveEvents     = events?.filter((e) => e.lifecycle === 'LIVE') ?? [];
  const activeEvents   = liveEvents.length;
  const upcomingCount  = events?.filter((e) => ['REG_OPEN', 'WEIGHIN', 'LOCKED', 'DRAWN', 'PUBLISHED'].includes(e.lifecycle)).length ?? 0;
  const completedCount = events?.filter((e) => e.lifecycle === 'COMPLETED').length ?? 0;
  const totalEvents    = events?.length ?? 0;

  const pipelineStageKeys = PIPELINE_STAGES.map((s) => s.key);
  const hasPipelineEvents  = (events ?? []).some((e) => pipelineStageKeys.includes(e.lifecycle));

  const hasNextEvent = (events ?? []).some(
    (e) => !['LIVE', 'COMPLETED'].includes(e.lifecycle),
  );

  const sortedEvents = [...(events ?? [])].sort(
    (a, b) => new Date(b.competitionStartDate).getTime() - new Date(a.competitionStartDate).getTime(),
  );

  const quickActions = [
    { key: 'events',     href: `/${locale}/admin/events`,             icon: Calendar, label: tNav('events'),             desc: t('linkEventsDescription'),    accent: '#3b82f6' },
    { key: 'draw',       href: `/${locale}/admin/draw`,               icon: Shuffle,  label: tNav('draw'),               desc: t('linkDrawDescription'),      accent: '#8b5cf6' },
    { key: 'weighin',    href: `/${locale}/admin/weighin`,            icon: Scale,    label: tNav('weighin'),            desc: t('linkWeighInDescription'),   accent: '#f59e0b' },
    { key: 'brackets',   href: `/${locale}/admin/brackets`,           icon: GitBranch,label: tNav('brackets'),           desc: t('linkBracketsDescription'),  accent: '#22c55e' },
    { key: 'athletes',   href: `/${locale}/admin/athletes`,           icon: Users,    label: tNav('athletes'),           desc: t('linkAthletesDescription'),  accent: '#ec4899' },
    { key: 'templates',  href: `/${locale}/admin/category-templates`, icon: FileText, label: tNav('categoryTemplates'), desc: t('linkRulesetsDescription'),  accent: '#06b6d4' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {/* Live Now banner */}
      {!isLoading && liveEvents.length > 0 && (
        <LiveBanner events={liveEvents} locale={locale} t={t} />
      )}

      {/* KPI row */}
      {isLoading ? (
        <SkeletonKpiRow count={4} />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          variants={adminVariants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={adminVariants.staggerChild}>
            <StatCard label={t('kpiTotal')}     value={totalEvents}   icon={Calendar}  accent="#3b82f6" />
          </motion.div>
          <motion.div variants={adminVariants.staggerChild}>
            <StatCard label={tEvents('kpiActive')} value={activeEvents} icon={Radio}     accent="#22c55e" />
          </motion.div>
          <motion.div variants={adminVariants.staggerChild}>
            <StatCard label={tEvents('kpiUpcoming')} value={upcomingCount} icon={Clock}  accent="#f59e0b" />
          </motion.div>
          <motion.div variants={adminVariants.staggerChild}>
            <StatCard label={tEvents('kpiCompleted')} value={completedCount} icon={Trophy} accent="#8b5cf6" />
          </motion.div>
        </motion.div>
      )}

      {/* Next event countdown — only if there's an upcoming event */}
      {!isLoading && hasNextEvent && events && (
        <motion.div variants={adminVariants.slideUp} initial="initial" animate="animate">
          <NextEventCountdown events={events} locale={locale} t={t} />
        </motion.div>
      )}

      {/* Event pipeline — only when at least one event is in an active stage */}
      {!isLoading && hasPipelineEvents && events && (
        <motion.section variants={adminVariants.slideUp} initial="initial" animate="animate">
          <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text)]">
            <Zap className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            {t('pipelineTitle')}
          </h2>
          <EventPipeline events={events} tEvents={(k) => tEvents(k as Parameters<typeof tEvents>[0])} />
        </motion.section>
      )}

      {/* Quick actions */}
      <motion.section variants={adminVariants.slideUp} initial="initial" animate="animate">
        <h2 className="mb-3 text-[13px] font-semibold text-[var(--color-text)]">{t('quickLinks')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map(({ key, ...qa }, i) => (
            <QuickTile key={key} {...qa} delay={i * 0.05} />
          ))}
        </div>
      </motion.section>

      {/* Recent events list */}
      <motion.section variants={adminVariants.slideUp} initial="initial" animate="animate">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[var(--color-text)]">{tEvents('recentTitle')}</h2>
          <Link
            href={`/${locale}/admin/events`}
            className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary)] transition hover:underline"
          >
            {tCommon('viewAll')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {isLoading ? (
          <SkeletonRows rows={4} cols={3} />
        ) : sortedEvents.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] py-12 text-center">
            <p className="text-[13px] font-medium text-[var(--color-text)]">{tEvents('emptyTitle')}</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{tEvents('emptyDescription')}</p>
          </div>
        ) : (
          <motion.div
            className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
            variants={adminVariants.staggerContainer}
            initial="initial"
            animate="animate"
          >
            {sortedEvents.slice(0, 6).map((ev) => (
              <EventListRow key={ev.id} ev={ev} locale={locale} tEvents={(k) => tEvents(k as Parameters<typeof tEvents>[0])} />
            ))}
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}
