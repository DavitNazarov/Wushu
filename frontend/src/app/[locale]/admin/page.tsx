'use client';

import { useTranslations, useLocale } from 'next-intl';
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
  ArrowRight,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/api/client';
import { adminVariants } from '@/lib/animations/variants';
import type { EventRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

import { PIPELINE_STAGES } from './dashboard.utils';
import { DashboardStatCard } from './components/dashboard/DashboardStatCard';
import { LiveBanner } from './components/dashboard/LiveBanner';
import { EventPipeline } from './components/dashboard/EventPipeline';
import { NextEventCountdown } from './components/dashboard/NextEventCountdown';
import { QuickTile } from './components/dashboard/QuickTile';
import { EventListRow } from './components/dashboard/EventListRow';

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
  const hasPipelineEvents = (events ?? []).some((e) => pipelineStageKeys.includes(e.lifecycle));

  const hasNextEvent = (events ?? []).some(
    (e) => !['LIVE', 'COMPLETED'].includes(e.lifecycle),
  );

  const sortedEvents = [...(events ?? [])].sort(
    (a, b) => new Date(b.competitionStartDate).getTime() - new Date(a.competitionStartDate).getTime(),
  );

  const quickActions = [
    { key: 'events',     href: `/${locale}/admin/events`,             icon: Calendar, label: tNav('events'),             desc: t('linkEventsDescription'),    accent: '#3b82f6' },
    { key: 'draw',       href: `/${locale}/admin/weighin-results`,    icon: Shuffle,  label: tNav('draw'),               desc: t('linkDrawDescription'),      accent: '#8b5cf6' },
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

      {!isLoading && liveEvents.length > 0 && (
        <LiveBanner events={liveEvents} locale={locale} t={t} />
      )}

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
            <DashboardStatCard label={t('kpiTotal')}     value={totalEvents}   icon={Calendar}  accent="#3b82f6" />
          </motion.div>
          <motion.div variants={adminVariants.staggerChild}>
            <DashboardStatCard label={tEvents('kpiActive')} value={activeEvents} icon={Radio}     accent="#22c55e" />
          </motion.div>
          <motion.div variants={adminVariants.staggerChild}>
            <DashboardStatCard label={tEvents('kpiUpcoming')} value={upcomingCount} icon={Clock}  accent="#f59e0b" />
          </motion.div>
          <motion.div variants={adminVariants.staggerChild}>
            <DashboardStatCard label={tEvents('kpiCompleted')} value={completedCount} icon={Trophy} accent="#8b5cf6" />
          </motion.div>
        </motion.div>
      )}

      {!isLoading && hasNextEvent && events && (
        <motion.div variants={adminVariants.slideUp} initial="initial" animate="animate">
          <NextEventCountdown events={events} locale={locale} t={t} />
        </motion.div>
      )}

      {!isLoading && hasPipelineEvents && events && (
        <motion.section variants={adminVariants.slideUp} initial="initial" animate="animate">
          <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text)]">
            <Zap className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            {t('pipelineTitle')}
          </h2>
          <EventPipeline events={events} locale={locale} tEvents={(k) => tEvents(k as Parameters<typeof tEvents>[0])} />
        </motion.section>
      )}

      <motion.section variants={adminVariants.slideUp} initial="initial" animate="animate">
        <h2 className="mb-3 text-[13px] font-semibold text-[var(--color-text)]">{t('quickLinks')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map(({ key, ...qa }, i) => (
            <QuickTile key={key} {...qa} delay={i * 0.05} />
          ))}
        </div>
      </motion.section>

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
