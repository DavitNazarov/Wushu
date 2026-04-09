'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronRight, Scale } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import type { AthleteProfileRegistrationRow } from '@/types/api';
import { formatAthleteDate } from './athleteProfile.utils';

type Props = {
  registrations: AthleteProfileRegistrationRow[];
  scope: 'admin' | 'coach' | 'public';
};

const WEIGH_IN_STATUS_LABEL_KEY: Record<
  NonNullable<AthleteProfileRegistrationRow['weighInStatus']>,
  'statusNotWeighed' | 'statusPassed' | 'statusMovedUp' | 'statusReweighPending' | 'statusDisqualified'
> = {
  NOT_WEIGHED: 'statusNotWeighed',
  PASSED: 'statusPassed',
  MOVED_UP: 'statusMovedUp',
  FAILED: 'statusDisqualified',
  OVERRIDE_APPROVED: 'statusPassed',
  REWEIGH_ALLOWED: 'statusReweighPending',
  DISQUALIFIED: 'statusDisqualified',
};

function registrationHref(scope: Props['scope'], locale: string, row: AthleteProfileRegistrationRow): string {
  if (scope === 'admin') return `/${locale}/admin/events/${row.eventId}`;
  if (scope === 'coach') return `/${locale}/coach/events/${row.eventSlug}/registrations`;
  return `/${locale}/events/${row.eventSlug}`;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function AthleteProfileRegistrations({ registrations, scope }: Props) {
  const t = useTranslations('athleteProfile.registrations');
  const tEvents = useTranslations('admin.events');
  const tRegistrations = useTranslations('registrations');
  const tWeighIn = useTranslations('weighin');
  const locale = useLocale();

  if (registrations.length === 0) {
    return <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{t('title')}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
          </div>
          <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)]">
            {registrations.length}
          </span>
        </div>

        <motion.div className="divide-y divide-[var(--color-border)]/50" variants={container} initial="hidden" animate="show">
          {registrations.map((row) => (
            <motion.div key={row.id} variants={item}>
              <Link
                href={registrationHref(scope, locale, row)}
                className="group flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-surface-alt)]/50"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="truncate text-[14px] font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                      {row.eventName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatAthleteDate(row.competitionStartDate, locale)}
                      </span>
                      <span>{row.ageGroupName ?? t('unknownAgeGroup')}</span>
                      <span>{row.finalWeightCategoryName ?? row.categoryCode}</span>
                    </div>
                    {row.movedUp && row.initialWeightCategoryName && row.finalWeightCategoryName && (
                      <p className="mt-1 text-[11px] font-medium text-[var(--color-warning)]">
                        {t('movedUp', { from: row.initialWeightCategoryName, to: row.finalWeightCategoryName })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <StatusChip
                      status={row.eventLifecycle}
                      label={tEvents(`lifecycle.${row.eventLifecycle}` as Parameters<typeof tEvents>[0])}
                      domain="lifecycle"
                    />
                    {scope !== 'public' && row.registrationStatus && (
                      <StatusChip
                        status={row.registrationStatus}
                        label={tRegistrations(`status.${row.registrationStatus}`)}
                        domain="registration"
                      />
                    )}
                  </div>

                  {scope !== 'public' && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        {
                          icon: Scale,
                          label: t('columns.weighIn'),
                          value: row.weighInStatus ? tWeighIn(WEIGH_IN_STATUS_LABEL_KEY[row.weighInStatus]) : '—',
                        },
                        { icon: null, label: t('columns.initialCategory'), value: row.initialWeightCategoryName ?? '—' },
                        { icon: null, label: t('columns.latestDecision'), value: row.latestWeighInDecision ? tWeighIn(`decisionOption${row.latestWeighInDecision}`) : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg bg-[var(--color-surface-alt)]/60 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
                          <p className="mt-0.5 text-[12px] font-medium text-[var(--color-text)]">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </Card>
    </motion.div>
  );
}
