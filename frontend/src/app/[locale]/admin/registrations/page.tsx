'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { EventRow, RegistrationRow, ClubRow } from '@/types/api';
import { RegistrationTable } from './RegistrationTable';
import { RegistrationConfirmModal, type ConfirmModalState } from './RegistrationConfirmModal';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

const LOCKED_LIFECYCLES = ['LOCKED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED'];

export default function RegistrationsPage() {
  const t = useTranslations('registrations');
  const tC = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { toast } = useToast();

  const eventId = searchParams.get('eventId') ?? '';
  const status = searchParams.get('status') ?? '';
  const clubId = searchParams.get('clubId') ?? '';
  const q = searchParams.get('q') ?? '';
  const categoryCode = searchParams.get('categoryCode') ?? '';

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

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });

  const selectedEvent = useMemo(() => events?.find((e) => e.id === eventId), [events, eventId]);
  const isLocked = selectedEvent && LOCKED_LIFECYCLES.includes(selectedEvent.lifecycle);

  const { data: regs, isLoading, error, refetch } = useQuery({
    queryKey: ['registrations', eventId, status || undefined, clubId || undefined, q || undefined, categoryCode || undefined],
    queryFn: () => {
      const params = new URLSearchParams({ eventId });
      if (status) params.set('status', status);
      if (clubId) params.set('clubId', clubId);
      if (q) params.set('q', q);
      if (categoryCode) params.set('categoryCode', categoryCode);
      return apiGet<RegistrationRow[]>(`/api/registrations?${params.toString()}`);
    },
    enabled: !!eventId,
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

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

  const rows = regs ?? [];
  const categories = useMemo(() => [...new Set(rows.map((r) => r.categoryCode))].sort(), [rows]);
  const hasActiveFilters = status || clubId || q || categoryCode;

  useEffect(() => {
    if (!eventId && events?.length === 1) setParams({ eventId: events[0].id });
  }, [eventId, events, setParams]);

  const filterSummary = [
    status && `Status: ${t(`status.${status}` as Parameters<typeof t>[0])}`,
    clubId && `Club: ${clubs?.find((c) => c.id === clubId)?.name ?? clubId}`,
    q && `Search: "${q}"`,
    categoryCode && `Category: ${categoryCode}`,
  ].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase text-[var(--color-text-muted)]">Event</label>
          <select className={SEL} value={eventId}
            onChange={(e) => setParams({ eventId: e.target.value, status: '', clubId: '', q: '', categoryCode: '' })}>
            <option value="">{t('selectEventPlaceholder')}</option>
            {events?.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} {ev.competitionStartDate ? `(${new Date(ev.competitionStartDate).toLocaleDateString()})` : ''}
              </option>
            ))}
          </select>
        </div>

        {eventId && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase text-[var(--color-text-muted)]">{t('filterStatus')}</label>
              <select className={SEL} value={status} onChange={(e) => setParams({ status: e.target.value })}>
                <option value="">All</option>
                {(['SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'PENDING'] as const).map((s) => (
                  <option key={s} value={s}>{t(`status.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase text-[var(--color-text-muted)]">{t('filterClub')}</label>
              <select className={SEL} value={clubId} onChange={(e) => setParams({ clubId: e.target.value })}>
                <option value="">{t('filterClubAll')}</option>
                {clubs?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase text-[var(--color-text-muted)]">{t('filterCategory')}</label>
              <select className={SEL} value={categoryCode} onChange={(e) => setParams({ categoryCode: e.target.value })}>
                <option value="">{t('filterCategoryAll')}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase text-[var(--color-text-muted)]">{t('filterSearch')}</label>
              <input type="search" placeholder={t('filterSearch')} value={q}
                onChange={(e) => setParams({ q: e.target.value })} className={SEL} autoComplete="off" />
            </div>
            {hasActiveFilters && (
              <SecondaryButton onClick={() => setParams({ status: '', clubId: '', q: '', categoryCode: '' })} className="self-end">
                {t('clearFilters')}
              </SecondaryButton>
            )}
          </>
        )}
      </div>

      {!eventId && <EmptyState title={t('selectEvent')} description={t('selectEventSubtitle')} />}
      {eventId && isLocked && <InlineAlert variant="warning">{t('registrationsLocked')}</InlineAlert>}

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tC('loadError')}
          retryLabel={tC('retry')}
          onRetry={() => refetch()}
        />
      )}

      {eventId && isLoading ? (
        <SkeletonRows rows={5} cols={6} />
      ) : eventId && rows.length === 0 ? (
        <EmptyState title={t('noResults')}
          description={filterSummary ? `${t('noResultsHint')} ${filterSummary}` : t('emptyDescription')} />
      ) : eventId && rows.length > 0 ? (
        <RegistrationTable
          rows={rows}
          isLocked={isLocked}
          t={(key) => t(key as Parameters<typeof t>[0])}
          onAction={(reg, action) => setConfirmModal({ reg, action, reason: '' })}
        />
      ) : null}

      <RegistrationConfirmModal
        state={confirmModal}
        isPending={statusMut.isPending}
        t={(key) => t(key as Parameters<typeof t>[0])}
        tC={(key) => tC(key as Parameters<typeof tC>[0])}
        onChange={(reason) => setConfirmModal((p) => (p ? { ...p, reason } : null))}
        onClose={() => setConfirmModal(null)}
        onConfirm={() =>
          confirmModal &&
          statusMut.mutate({ id: confirmModal.reg.id, status: confirmModal.action, reason: confirmModal.reason || undefined })
        }
      />
    </div>
  );
}
