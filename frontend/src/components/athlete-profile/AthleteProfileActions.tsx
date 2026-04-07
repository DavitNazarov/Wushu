'use client';

import Link from 'next/link';
import { ArrowRight, CalendarRange, ListChecks, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { getAdminEventPath } from '@/features/admin-events/lib/adminEventRoutes';
import type { AthleteProfileRegistrationRow } from '@/types/api';

type Props = {
  scope: 'admin' | 'coach';
  registrations: AthleteProfileRegistrationRow[];
};

export function AthleteProfileActions({ scope, registrations }: Props) {
  const t = useTranslations('athleteProfile.actions');
  const locale = useLocale();
  const latestRegistration = registrations[0];

  const actions =
    scope === 'admin'
      ? [
          { id: 'athletes', href: `/${locale}/admin/athletes`, label: t('admin.athletes'), description: t('admin.athletesDescription') },
          {
            id: 'registrations',
            href: latestRegistration
              ? getAdminEventPath(locale, latestRegistration.eventId, 'registrations')
              : `/${locale}/admin/events`,
            label: t('admin.registrations'),
            description: t('admin.registrationsDescription'),
          },
          ...(latestRegistration
            ? [
                {
                  id: 'event',
                  href: getAdminEventPath(locale, latestRegistration.eventId),
                  label: t('admin.event'),
                  description: t('admin.eventDescription', { event: latestRegistration.eventName }),
                },
              ]
            : []),
        ]
      : [
          { id: 'athletes', href: `/${locale}/coach/athletes`, label: t('coach.athletes'), description: t('coach.athletesDescription') },
          { id: 'events', href: `/${locale}/coach/events`, label: t('coach.events'), description: t('coach.eventsDescription') },
          ...(latestRegistration
            ? [
                {
                  id: 'event',
                  href: `/${locale}/coach/events/${latestRegistration.eventSlug}/registrations`,
                  label: t('coach.event'),
                  description: t('coach.eventDescription', { event: latestRegistration.eventName }),
                },
              ]
            : []),
        ];

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('title')}</h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
      </div>
      <div className="space-y-2">
        {actions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface-alt)_55%,transparent),transparent)] px-4 py-3 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                  {action.id === 'athletes' ? (
                    <Users className="h-4 w-4" />
                  ) : action.id === 'event' ? (
                    <CalendarRange className="h-4 w-4" />
                  ) : (
                    <ListChecks className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text)]">{action.label}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{action.description}</p>
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
