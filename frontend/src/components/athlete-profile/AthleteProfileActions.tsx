'use client';

import Link from 'next/link';
import { ArrowRight, CalendarRange, ListChecks, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { getAdminEventPath } from '@/features/admin-events/lib/adminEventRoutes';
import type { AthleteProfileRegistrationRow } from '@/types/api';

type Props = {
  scope: 'admin' | 'coach';
  registrations: AthleteProfileRegistrationRow[];
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2 } },
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

  const iconMap: Record<string, typeof Users> = {
    athletes: Users,
    event: CalendarRange,
    events: CalendarRange,
    registrations: ListChecks,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)]/60 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{t('title')}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
        </div>

        <motion.div className="divide-y divide-[var(--color-border)]/50" variants={container} initial="hidden" animate="show">
          {actions.map((action) => {
            const Icon = iconMap[action.id] ?? ListChecks;
            return (
              <motion.div key={action.id} variants={item}>
                <Link
                  href={action.href}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-alt)]/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] transition-transform group-hover:scale-110">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--color-text)]">{action.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </Card>
    </motion.div>
  );
}
