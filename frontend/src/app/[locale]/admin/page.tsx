import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Calendar, FileText } from 'lucide-react';

export default async function AdminDashboardPage() {
  const tAdmin = await getTranslations('admin');
  const locale = await getLocale();

  const kpis = [
    { label: tAdmin('events.kpiActive'), value: '2', colour: 'text-emerald-500' },
    { label: tAdmin('events.kpiUpcoming'), value: '3', colour: 'text-amber-500' },
    { label: tAdmin('events.kpiCompleted'), value: '12', colour: 'text-[var(--color-text-muted)]' },
  ];

  const recentEvents = [
    { name: 'Tbilisi Open 2026', date: '2026-04-15', status: 'REG_OPEN' },
    { name: 'National Championship', date: '2026-05-20', status: 'DRAWN' },
  ];

  return (
    <AppShell title={tAdmin('dashboard.title')}>
      <div className="space-y-8">
        <div>
          <p className="text-[15px] text-[var(--color-text-muted)]">
            {tAdmin('dashboard.welcome')}
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tAdmin('dashboard.subtitle')}
          </p>
        </div>

        <section>
          <div className="grid gap-4 sm:grid-cols-3">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="p-5">
                <p className="text-[13px] text-[var(--color-text-muted)]">{kpi.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${kpi.colour}`}>{kpi.value}</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title={tAdmin('dashboard.quickLinks')} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href={`/${locale}/admin/rulesets`}
              className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-5 transition hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-alt)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                <FileText className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-text)]">
                  {tAdmin('dashboard.linkRulesetsTitle')}
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                  {tAdmin('dashboard.linkRulesetsDescription')}
                </p>
              </div>
              <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]">
                →
              </span>
            </Link>

            <Link
              href={`/${locale}/admin/events`}
              className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-5 transition hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-alt)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                <Calendar className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-text)]">
                  {tAdmin('dashboard.linkEventsTitle')}
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                  {tAdmin('dashboard.linkEventsDescription')}
                </p>
              </div>
              <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]">
                →
              </span>
            </Link>
          </div>
        </section>

        <section>
          <SectionHeader
            title={tAdmin('events.recentTitle')}
            action={
              <Link href={`/${locale}/admin/events`}>
                <PrimaryButton>{tAdmin('events.new')}</PrimaryButton>
              </Link>
            }
          />
          <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
            <table className="min-w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {recentEvents.map((ev) => (
                  <tr key={ev.name} className="bg-[var(--color-surface)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{ev.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{ev.date}</td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{ev.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
