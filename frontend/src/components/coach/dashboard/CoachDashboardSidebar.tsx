'use client';

import Link from 'next/link';
import { Calendar, ClipboardList, Scale, UserCircle2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import type { CoachDashboardContext, DashboardQuickAction } from './types';

type Props = {
  context: CoachDashboardContext;
  athleteCount: number;
  quickActions: DashboardQuickAction[];
};

function quickActionIcon(id: DashboardQuickAction['id']) {
  if (id === 'athletes') return Users;
  if (id === 'events') return Calendar;
  if (id === 'registrations') return ClipboardList;
  if (id === 'weighin') return Scale;
  return UserCircle2;
}

export function CoachDashboardSidebar({ context, athleteCount, quickActions }: Props) {
  const t = useTranslations('coach.dashboard.sidebar');
  const tQuick = useTranslations('coach.dashboard.quickActions');

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('eyebrow')}</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--color-text)]">{context.clubName ?? t('noClub')}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{context.displayName ?? '—'}</p>
        </div>
        <div className="grid gap-3 text-[13px]">
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 px-3 py-2.5">
            <span className="block text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('organisation')}</span>
            <span className="mt-1 block text-[14px] font-medium text-[var(--color-text)]">{context.organisationName ?? '—'}</span>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 px-3 py-2.5">
            <span className="block text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('athletes')}</span>
            <span className="mt-1 block text-[14px] font-medium text-[var(--color-text)]">{athleteCount}</span>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{tQuick('title')}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{tQuick('subtitle')}</p>
        </div>
        <div className="space-y-2">
          {quickActions.map((action) => {
            const Icon = quickActionIcon(action.id);
            return (
              <Link
                key={action.id}
                href={action.href}
                className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/30 px-3 py-3 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--color-text)]">{tQuick(`items.${action.labelKey}.label`)}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{tQuick(`items.${action.labelKey}.description`)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
