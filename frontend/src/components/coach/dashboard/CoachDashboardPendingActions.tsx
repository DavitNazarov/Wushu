'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, ChevronRight, Clock3, Scale, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DashboardPendingAction } from './types';

type Props = {
  actions: DashboardPendingAction[];
};

function priorityClasses(priority: DashboardPendingAction['priority']): string {
  if (priority === 'high') return 'border-[var(--color-danger)]/30 bg-[var(--color-danger-subtle)]/35';
  if (priority === 'medium') return 'border-[var(--color-warning)]/30 bg-[var(--color-warning-subtle)]/25';
  return 'border-[var(--color-border)] bg-[var(--color-surface-alt)]/50';
}

export function CoachDashboardPendingActions({ actions }: Props) {
  const t = useTranslations('coach.dashboard.pendingActions');
  const locale = useLocale();

  const formatDate = (value: string | null | undefined) =>
    value
      ? new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
      : null;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('title')}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('subtitle')}</p>
        </div>
        <div className="rounded-[var(--radius-pill)] bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
          {t('count', { count: actions.length })}
        </div>
      </div>

      {actions.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="space-y-3">
          {actions.slice(0, 8).map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)] ${priorityClasses(action.priority)}`}
            >
              <div className="mt-0.5 rounded-lg bg-[var(--color-surface)] p-2 text-[var(--color-primary)]">
                {action.titleKey === 'completeAthleteProfile' ? (
                  <UserRound className="h-4 w-4" />
                ) : action.titleKey === 'weighInActive' ? (
                  <Scale className="h-4 w-4" />
                ) : action.titleKey === 'registrationClosingSoon' ? (
                  <Clock3 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--color-text)]">
                  {t(`items.${action.titleKey}.title`, {
                    athleteName: action.athleteName ?? '',
                    eventName: action.eventName ?? '',
                  })}
                </p>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {t(`items.${action.titleKey}.description`, {
                    athleteName: action.athleteName ?? '',
                    athleteCount: action.athleteCount ?? 0,
                    eventName: action.eventName ?? '',
                    registrationCount: action.registrationCount ?? 0,
                    date: formatDate(action.dueDate) ?? '',
                  })}
                </p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
