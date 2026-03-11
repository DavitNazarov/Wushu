'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
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
          { id: 'registrations', href: `/${locale}/admin/registrations`, label: t('admin.registrations'), description: t('admin.registrationsDescription') },
          ...(latestRegistration
            ? [
                {
                  id: 'event',
                  href: `/${locale}/admin/events/${latestRegistration.eventId}`,
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
            className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/30 px-3 py-3 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
          >
            <p className="text-[13px] font-medium text-[var(--color-text)]">{action.label}</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{action.description}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}
