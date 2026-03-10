'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Calendar, FileText, ClipboardList, Scale, Shuffle, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/Skeleton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { apiGet } from '@/lib/api/client';
import type { EventRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

export default function AdminDashboardPage() {
  const t = useTranslations('admin.dashboard');
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const kpis = events
    ? [
        {
          label: tEvents('kpiActive'),
          value: events.filter((e) => e.lifecycle === 'LIVE').length,
          icon: <Calendar className="h-4 w-4" />,
          color: 'var(--color-success)',
        },
        {
          label: tEvents('kpiUpcoming'),
          value: events.filter((e) => ['REG_OPEN', 'WEIGHIN', 'LOCKED', 'DRAWN', 'PUBLISHED'].includes(e.lifecycle)).length,
          icon: <ClipboardList className="h-4 w-4" />,
          color: 'var(--color-warning)',
        },
        {
          label: tEvents('kpiCompleted'),
          value: events.filter((e) => e.lifecycle === 'COMPLETED').length,
          icon: <Trophy className="h-4 w-4" />,
        },
      ]
    : [];

  const recentEvents = events?.slice(0, 5) ?? [];

  type QuickAction = { key: string; href: string; icon: typeof Calendar; label: string; desc: string };
  const quickActions: QuickAction[] = [
    { key: 'events', href: '/admin/events', icon: Calendar, label: tNav('events'), desc: t('linkEventsDescription') },
    { key: 'rulesets', href: '/admin/rulesets', icon: FileText, label: tNav('rulesets'), desc: t('linkRulesetsDescription') },
    { key: 'weighin', href: '/admin/weighin', icon: Scale, label: tNav('weighin'), desc: tNav('weighin') },
    { key: 'draw', href: '/admin/draw', icon: Shuffle, label: tNav('draw'), desc: tNav('draw') },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <SkeletonKpiRow />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t('quickLinks')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <Link
                key={qa.key}
                href={`/${locale}${qa.href}`}
                className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--color-text)]">{qa.label}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{qa.desc}</p>
                </div>
                <span className="text-[var(--color-text-muted)] transition group-hover:text-[var(--color-primary)]">→</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{tEvents('recentTitle')}</h2>
          <Link href={`/${locale}/admin/events`}>
            <PrimaryButton>{tEvents('new')}</PrimaryButton>
          </Link>
        </div>

        {isLoading ? (
          <SkeletonRows rows={3} cols={3} />
        ) : recentEvents.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] py-12 text-center">
            <p className="text-sm font-medium text-[var(--color-text)]">{tEvents('emptyTitle')}</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{tEvents('emptyDescription')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
            {/* Desktop table */}
            <table className="hidden min-w-full text-[13px] sm:table">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tEvents('columns.name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tEvents('columns.dates')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tEvents('columns.lifecycle')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {recentEvents.map((ev) => (
                  <tr key={ev.id} className="bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                      <Link href={`/${locale}/admin/events`} className="hover:underline">{ev.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {new Date(ev.competitionStartDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip
                        status={ev.lifecycle}
                        label={tEvents(`lifecycle.${ev.lifecycle}` as Parameters<typeof tEvents>[0])}
                        domain="lifecycle"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile stacked cards */}
            <div className="divide-y divide-[var(--color-border)] sm:hidden">
              {recentEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between gap-3 bg-[var(--color-surface)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{ev.name}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                      {new Date(ev.competitionStartDate).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusChip
                    status={ev.lifecycle}
                    label={tEvents(`lifecycle.${ev.lifecycle}` as Parameters<typeof tEvents>[0])}
                    domain="lifecycle"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
