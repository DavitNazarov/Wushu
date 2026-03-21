'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
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
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('title')}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
        </div>
        <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
          {registrations.length}
        </span>
      </div>

      <div className="space-y-3">
        {registrations.map((row) => (
          <Link
            key={row.id}
            href={registrationHref(scope, locale, row)}
            className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface-alt)_60%,transparent),transparent)] p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]/60"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[14px] font-semibold text-[var(--color-text)]">{row.eventName}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {formatAthleteDate(row.competitionStartDate, locale)}
                  {' · '}
                  {row.ageGroupName ?? t('unknownAgeGroup')}
                  {' · '}
                  {row.finalWeightCategoryName ?? row.categoryCode}
                </p>
                {row.movedUp && row.initialWeightCategoryName && row.finalWeightCategoryName && (
                  <p className="mt-1 text-[12px] text-[var(--color-warning)]">
                    {t('movedUp', {
                      from: row.initialWeightCategoryName,
                      to: row.finalWeightCategoryName,
                    })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
            </div>

            {scope !== 'public' && (
              <div className="mt-3 grid gap-3 text-[12px] text-[var(--color-text-muted)] sm:grid-cols-3">
                <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)]/55 px-3 py-2">
                  <span className="block text-[11px] uppercase tracking-wide">{t('columns.weighIn')}</span>
                  <span className="mt-1 block text-[13px] text-[var(--color-text)]">
                    {row.weighInStatus ? tWeighIn(WEIGH_IN_STATUS_LABEL_KEY[row.weighInStatus]) : '—'}
                  </span>
                </div>
                <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)]/55 px-3 py-2">
                  <span className="block text-[11px] uppercase tracking-wide">{t('columns.initialCategory')}</span>
                  <span className="mt-1 block text-[13px] text-[var(--color-text)]">{row.initialWeightCategoryName ?? '—'}</span>
                </div>
                <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)]/55 px-3 py-2">
                  <span className="block text-[11px] uppercase tracking-wide">{t('columns.latestDecision')}</span>
                  <span className="mt-1 block text-[13px] text-[var(--color-text)]">
                    {row.latestWeighInDecision ? tWeighIn(`decisionOption${row.latestWeighInDecision}`) : '—'}
                  </span>
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
