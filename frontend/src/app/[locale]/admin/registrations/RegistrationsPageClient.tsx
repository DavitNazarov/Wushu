'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/pagination/Pagination';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiGetWithTotal, apiPost } from '@/lib/api/client';
import { localizedFullName, localizedName } from '@/lib/bilingual';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { ClubRow, RegistrationBulkStatusResponse, RegistrationRow } from '@/types/api';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventRoute } from '@/features/admin-events/hooks/useAdminEventRoute';
import { RegistrationTable } from './RegistrationTable';
import { RegistrationConfirmModal, type ConfirmModalState } from './RegistrationConfirmModal';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { RegistrationBulkActions } from './RegistrationBulkActions';
import { RegistrationFilters } from './RegistrationFilters';
import { AddAthleteToEventModal } from './AddAthleteToEventModal';
import { getEligibleRegistrationIds, type RowAction } from './registrationStatusActions';

const EMPTY_REGISTRATIONS: RegistrationRow[] = [];
const EMPTY_CATEGORIES: string[] = [];
const PAGE_SIZE = 10;

type Props = {
  eventId: string;
};

export function RegistrationsPageClient({ eventId }: Props) {
  const t = useTranslations('registrations');
  const tC = useTranslations('common');
  const tGate = useTranslations('eventPhaseGate');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { toast } = useToast();

  const status = searchParams.get('status') ?? '';
  const clubId = searchParams.get('clubId') ?? '';
  const q = searchParams.get('q') ?? '';
  const categoryCode = searchParams.get('categoryCode') ?? '';
  const parsedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname],
  );

  // Any filter change resets to page 1 — otherwise a narrowed result set could
  // leave you stranded on a now-empty page.
  const setFilter = useCallback(
    (updates: Record<string, string>) => setParams({ ...updates, page: '' }),
    [setParams],
  );

  const goToPage = useCallback(
    (next: number) => setParams({ page: next > 1 ? String(next) : '' }),
    [setParams],
  );

  const { events, selectedEvent, setSelectedEventId } = useAdminEventRoute({
    eventId,
    page: 'registrations',
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });

  const gate = resolveEventControlGate('registrations', selectedEvent ?? null);
  const isLocked = gate.mode !== 'active';
  const showContent = gate.mode === 'active' || gate.mode === 'locked';

  const { data, isLoading, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['registrations', eventId, status || undefined, clubId || undefined, q || undefined, categoryCode || undefined, page],
    queryFn: () => {
      const params = new URLSearchParams({ eventId });
      if (status) params.set('status', status);
      if (clubId) params.set('clubId', clubId);
      if (q) params.set('q', q);
      if (categoryCode) params.set('categoryCode', categoryCode);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((page - 1) * PAGE_SIZE));
      return apiGetWithTotal<RegistrationRow[]>(`/api/registrations?${params.toString()}`);
    },
    enabled: !!eventId && showContent,
    // Keep the previous page on screen while the next one loads — no flash of
    // the skeleton/empty state when stepping through pages.
    placeholderData: (prev) => prev,
  });

  // Full distinct category list for the filter dropdown — fetched separately so
  // it stays complete regardless of which page of rows is loaded.
  const { data: categoryCodes } = useQuery({
    queryKey: ['registrations', eventId, 'category-codes'],
    queryFn: () => apiGet<string[]>(`/api/registrations/category-codes?eventId=${eventId}`),
    enabled: !!eventId && showContent,
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);

  const statusMut = useMutation({
    mutationFn: ({ id, status: s, reason }: { id: string; status: string; reason?: string }) =>
      apiPost(`/api/registrations/${id}/status`, { status: s, reason: reason || undefined }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      if (vars.status === 'APPROVED') toast(t('approveSuccess'));
      else if (vars.status === 'REJECTED') toast(t('rejectSuccess'));
      else toast(t('withdrawSuccess'));
      setConfirmModal(null);
    },
    onError: (error) => {
      toast(getCompactErrorMessage(error, t('updateFailed')), 'error');
    },
  });

  const bulkStatusMut = useMutation({
    mutationFn: ({
      status: action,
      reason,
      registrationIds,
    }: {
      status: RowAction;
      reason?: string;
      registrationIds: string[];
    }) =>
      apiPost<RegistrationBulkStatusResponse>('/api/registrations/bulk-status', {
        status: action,
        reason: reason || undefined,
        registrationIds,
      }),
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      const actionLabel =
        vars.status === 'APPROVED'
          ? t('actions.approveAll')
          : vars.status === 'REJECTED'
            ? t('actions.rejectAll')
            : t('actions.withdrawAll');
      toast(
        t('bulk.successSummary', {
          action: actionLabel,
          updated: result.updatedCount,
          skipped: result.skippedCount,
          failed: result.failedCount,
        }),
      );
      setConfirmModal(null);
    },
    onError: (mutationError) => {
      toast(getCompactErrorMessage(mutationError, t('bulk.updateFailed')), 'error');
    },
  });

  const rows = data?.rows ?? EMPTY_REGISTRATIONS;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categories = categoryCodes ?? EMPTY_CATEGORIES;
  const hasActiveFilters = status || clubId || q || categoryCode;

  // If the loaded data shrinks below the current page (e.g. after withdrawing
  // the last rows on the final page), step back into range.
  useEffect(() => {
    if (data && !isPlaceholderData && page > totalPages) {
      goToPage(totalPages);
    }
  }, [data, isPlaceholderData, page, totalPages, goToPage]);

  const fromRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRow = Math.min(page * PAGE_SIZE, total);
  const bulkCounts = useMemo(
    () => ({
      APPROVED: getEligibleRegistrationIds(rows, 'APPROVED').length,
      REJECTED: getEligibleRegistrationIds(rows, 'REJECTED').length,
      WITHDRAWN: getEligibleRegistrationIds(rows, 'WITHDRAWN').length,
    }),
    [rows],
  );

  const filterSummary = [
    status && `${t('filterStatus')}: ${t(`status.${status}` as Parameters<typeof t>[0])}`,
    clubId && `${t('filterClub')}: ${clubs?.find((c) => c.id === clubId)?.name ?? clubId}`,
    q && `${t('filterSearchLabel')}: "${q}"`,
    categoryCode && `${t('filterCategory')}: ${categoryCode}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          showContent && eventId ? (
            <PrimaryButton onClick={() => setAddAthleteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('addAthlete.button')}
            </PrimaryButton>
          ) : undefined
        }
      />

      <RegistrationFilters
        eventId={eventId}
        status={status}
        clubId={clubId}
        categoryCode={categoryCode}
        query={q}
        events={events}
        clubs={clubs}
        categories={categories}
        showFilters={showContent}
        hasActiveFilters={Boolean(hasActiveFilters)}
        onEventChange={setSelectedEventId}
        onStatusChange={(value) => setFilter({ status: value })}
        onClubChange={(value) => setFilter({ clubId: value })}
        onCategoryChange={(value) => setFilter({ categoryCode: value })}
        onQueryChange={(value) => setFilter({ q: value })}
        onClearFilters={() => setFilter({ status: '', clubId: '', q: '', categoryCode: '' })}
      />

      {gate.mode !== 'active' && (
        <EventPhaseGate
          gate={gate}
          locale={locale}
          t={(key, values) =>
            tGate(
              key as Parameters<typeof tGate>[0],
              values as Record<string, string | number | Date> | undefined,
            )
          }
          tEvents={(key) => tEvents(key as Parameters<typeof tEvents>[0])}
        />
      )}

      {showContent && rows.length > 0 && (
        <RegistrationBulkActions
          counts={bulkCounts}
          disabled={!!isLocked}
          isPending={bulkStatusMut.isPending}
          t={(key) => t(key as Parameters<typeof t>[0])}
          onAction={(action) =>
            setConfirmModal({
              action,
              reason: '',
              description: t('bulk.confirmDescription', {
                count: getEligibleRegistrationIds(rows, action).length,
              }),
              scope: 'bulk',
            })
          }
        />
      )}

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tC('loadError')}
          retryLabel={tC('retry')}
          onRetry={() => refetch()}
        />
      )}

      {showContent && isLoading ? (
        <SkeletonRows rows={5} cols={6} />
      ) : showContent && rows.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-5 text-[13px] text-[var(--color-text-muted)]">
          {filterSummary ? `${t('noResultsHint')} ${filterSummary}` : t('emptyDescription')}
        </p>
      ) : showContent && rows.length > 0 ? (
        <RegistrationTable
          rows={rows}
          isLocked={isLocked}
          t={(key) => t(key as Parameters<typeof t>[0])}
          onAction={(reg, action) =>
            setConfirmModal({
              reg,
              action,
              reason: '',
              scope: 'single',
              description: `${reg.athlete ? localizedFullName(reg.athlete.firstName, reg.athlete.lastName, reg.athlete.firstNameKa, reg.athlete.lastNameKa, locale) : reg.athleteId} · ${reg.club ? localizedName(reg.club.name, reg.club.nameKa, locale) : '—'} · ${reg.categoryCode}`,
            })
          }
        />
      ) : null}

      {showContent && total > 0 && (
        <div className="flex flex-col items-center gap-3 pt-1 sm:flex-row sm:justify-between">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {t('pageSummary', { from: fromRow, to: toRow, total })}
          </p>
          <Pagination
            currentPage={Math.min(page, totalPages)}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>
      )}

      <AddAthleteToEventModal
        open={addAthleteOpen}
        onClose={() => setAddAthleteOpen(false)}
        eventId={eventId}
      />

      <RegistrationConfirmModal
        state={confirmModal}
        isPending={statusMut.isPending || bulkStatusMut.isPending}
        t={(key) => t(key as Parameters<typeof t>[0])}
        tC={(key) => tC(key as Parameters<typeof tC>[0])}
        onChange={(reason) => setConfirmModal((p) => (p ? { ...p, reason } : null))}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          if (!confirmModal) return;
          if (confirmModal.scope === 'single' && confirmModal.reg) {
            statusMut.mutate({
              id: confirmModal.reg.id,
              status: confirmModal.action,
              reason: confirmModal.reason || undefined,
            });
            return;
          }

          const registrationIds = getEligibleRegistrationIds(rows, confirmModal.action);
          if (registrationIds.length === 0) {
            setConfirmModal(null);
            return;
          }

          bulkStatusMut.mutate({
            status: confirmModal.action,
            reason: confirmModal.reason || undefined,
            registrationIds,
          });
        }}
      />
    </div>
  );
}
