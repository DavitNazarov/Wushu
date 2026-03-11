'use client';

import { CalendarDays, ClipboardList, Scale, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { KpiCard } from '@/components/ui/KpiCard';
import type { DashboardSummary } from './types';

type Props = {
  summary: DashboardSummary;
};

export function CoachDashboardSummaryCards({ summary }: Props) {
  const t = useTranslations('coach.dashboard.summary');

  const cards = [
    {
      key: 'totalAthletes',
      label: t('totalAthletes'),
      value: summary.totalAthletes,
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: 'activeRegistrations',
      label: t('activeRegistrations'),
      value: summary.activeRegistrations,
      icon: <ClipboardList className="h-4 w-4" />,
      color: 'var(--color-info)',
    },
    {
      key: 'pendingWeighIns',
      label: t('pendingWeighIns'),
      value: summary.pendingWeighIns,
      icon: <Scale className="h-4 w-4" />,
      color: 'var(--color-warning)',
    },
    {
      key: 'upcomingEvents',
      label: t('upcomingEvents'),
      value: summary.upcomingEvents,
      icon: <CalendarDays className="h-4 w-4" />,
      color: 'var(--color-success)',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={card.value}
          icon={card.icon}
          color={card.color}
        />
      ))}
    </div>
  );
}
