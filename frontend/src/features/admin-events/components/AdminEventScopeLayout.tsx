'use client';

import { ReactNode } from 'react';
import { notFound, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { StatusChip } from '@/components/ui/StatusChip';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { apiGet } from '@/lib/api/client';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';
import {
  ADMIN_EVENT_NAV_PAGES,
  getAdminEventPath,
  matchAdminEventRoute,
} from '../lib/adminEventRoutes';

type Props = {
  eventId: string;
  children: ReactNode;
};

function formatDateRange(event: EventRow, locale: string) {
  return `${new Date(event.competitionStartDate).toLocaleDateString(locale)} - ${new Date(
    event.competitionEndDate,
  ).toLocaleDateString(locale)}`;
}

export function AdminEventScopeLayout({ eventId, children }: Props) {
  const locale = useLocale();
  const pathname = usePathname() ?? '';
  const tEvents = useTranslations('admin.events');
  const tNav = useTranslations('nav');
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const event = (eventsQuery.data ?? []).find((row) => row.id === eventId) ?? null;
  const routeMatch = matchAdminEventRoute(pathname, locale);
  const currentPage = routeMatch?.page ?? 'overview';

  if (eventsQuery.isFetched && !event) {
    notFound();
  }

  const tabLabel = (page: (typeof ADMIN_EVENT_NAV_PAGES)[number]) => {
    if (page === 'overview') return tPublic('overview');
    return tNav(page as Parameters<typeof tNav>[0]);
  };

  return (
    <div className="space-y-4">
      {eventsQuery.error ? (
        <AdminErrorAlert
          error={eventsQuery.error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => eventsQuery.refetch()}
        />
      ) : null}

      {eventsQuery.isLoading ? (
        <SkeletonRows rows={1} cols={4} />
      ) : event ? (
        <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {currentPage !== 'overview' ? (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Link
                  href={`/${locale}/admin/events`}
                  className="mb-2 inline-flex text-[12px] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
                >
                  ← {tCommon('back')}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-[18px] font-semibold text-[var(--color-text)]">
                    {localizedName(event.name, event.nameKa, locale)}
                  </h2>
                  <StatusChip
                    status={event.lifecycle}
                    label={tEvents(
                      `lifecycle.${event.lifecycle}` as Parameters<typeof tEvents>[0],
                    )}
                    domain="lifecycle"
                  />
                </div>
                <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                  {formatDateRange(event, locale)}
                </p>
              </div>
            </div>
          ) : null}

          <nav className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ADMIN_EVENT_NAV_PAGES.map((page) => {
              const active = currentPage === page;
              return (
                <Link
                  key={page}
                  href={getAdminEventPath(locale, eventId, page)}
                  className={`min-h-[40px] shrink-0 rounded-[var(--radius-pill)] border px-3 py-2 text-[12px] font-medium transition ${
                    active
                      ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 text-[var(--color-text)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {tabLabel(page)}
                </Link>
              );
            })}
          </nav>
        </section>
      ) : null}

      {children}
    </div>
  );
}
