'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import type { EventRow, RegistrationRow, AthleteRow } from '@/types/api';
import { CategoryPicker } from '@/components/registration/CategoryPicker';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CoachRegistrationsPage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const t = useTranslations('coach.registrations');
  const tReg = useTranslations('registrations');
  const tC = useTranslations('common');
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState('');
  const [eventWeightCategoryId, setEventWeightCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [regClosedError, setRegClosedError] = useState(false);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['public', 'event', eventSlug],
    queryFn: () => apiGet<EventRow>(`/api/public/events/${eventSlug}`),
    enabled: !!eventSlug,
  });

  const eventId = event?.id ?? '';
  const regStatus = event?.registrationStatus ?? null;
  const isRegOpen = regStatus === 'OPEN';

  const { data: regs, isLoading, error, refetch } = useQuery({
    queryKey: ['registrations', eventId],
    queryFn: () => apiGet<RegistrationRow[]>(`/api/registrations?eventId=${eventId}`),
    enabled: !!eventId,
  });

  const { data: athletes } = useQuery({
    queryKey: ['athletes'],
    queryFn: () => apiGet<AthleteRow[]>('/api/athletes'),
    enabled: addOpen,
  });

  const createMut = useMutation({
    mutationFn: (body: { eventId: string; athleteId: string; eventWeightCategoryId: string; notes?: string }) =>
      apiPost<RegistrationRow>('/api/registrations', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      setAddOpen(false);
      setSelectedAthleteId('');
      setSelectedAgeGroupId('');
      setEventWeightCategoryId('');
      setNotes('');
      setRegClosedError(false);
      toast(tC('saveSuccess'));
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 403) {
        const code = (e.details as { code?: string } | null)?.code ?? e.message;
        if (code === 'REGISTRATION_CLOSED') {
          setRegClosedError(true);
          setAddOpen(false);
          toast(t('regClosedError'), 'error');
          return;
        }
      }
      toast(e instanceof ApiError ? e.message : tC('error'), 'error');
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      apiPost(`/api/registrations/${id}/status`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      setWithdrawId(null);
      setWithdrawReason('');
      toast(tReg('statusUpdated'));
    },
    onError: () => toast(tC('error'), 'error'),
  });

  const rows = regs ?? [];

  const handleAdd = () => {
    if (!eventId || !selectedAthleteId || !eventWeightCategoryId) return;
    createMut.mutate({ eventId, athleteId: selectedAthleteId, eventWeightCategoryId, notes: notes.trim() || undefined });
  };

  const handleWithdraw = () => {
    if (!withdrawId) return;
    statusMut.mutate({ id: withdrawId, status: 'WITHDRAWN', reason: withdrawReason.trim() || undefined });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={event?.name ?? eventSlug}
        subtitle={t('title')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/${locale}/coach/events`} className="text-[13px] text-[var(--color-text-muted)] hover:underline">
              ← {tC('back')}
            </Link>
            <Link href={`/${locale}/coach/events/${eventSlug}/brackets`} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">Brackets</Link>
            <Link href={`/${locale}/coach/events/${eventSlug}/schedule`} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">Schedule</Link>
            <Link href={`/${locale}/coach/events/${eventSlug}/live`} className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">Live</Link>
            <SecondaryButton
              onClick={() => { setRegClosedError(false); setAddOpen(true); }}
              disabled={!eventId || !isRegOpen}
              title={!isRegOpen ? t('regStatusClosed') : undefined}
            >
              {t('addRegistration')}
            </SecondaryButton>
          </div>
        }
      />

      {/* Registration window status banner */}
      {event && regStatus && (
        <InlineAlert variant={regStatus === 'OPEN' ? 'success' : regStatus === 'UPCOMING' ? 'warning' : 'error'}>
          {regStatus === 'UPCOMING' && t('regStatusUpcoming', { date: formatDate(event.registrationOpensAt) })}
          {regStatus === 'OPEN' && t('regStatusOpen', { date: formatDate(event.registrationClosesAt) })}
          {regStatus === 'CLOSED' && t('regStatusClosed')}
        </InlineAlert>
      )}

      {/* Backend 403 REGISTRATION_CLOSED error banner */}
      {regClosedError && (
        <InlineAlert variant="error">{t('regClosedError')}</InlineAlert>
      )}

      {error && (
        <InlineAlert variant="error" actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tC('retry')}</button>}>
          {tC('loadError')}
        </InlineAlert>
      )}

      {eventLoading || isLoading ? (
        <SkeletonRows rows={5} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-[var(--color-surface-alt)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tReg('columns.athlete')}</th>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tReg('columns.category')}</th>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tReg('columns.status')}</th>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tReg('columns.notes')}</th>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tC('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((reg) => (
                <tr key={reg.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">
                    {reg.athlete ? `${reg.athlete.firstName} ${reg.athlete.lastName}` : reg.athleteId}
                  </td>
                  <td className="px-4 py-3">{reg.categoryCode}</td>
                  <td className="px-4 py-3">
                    <StatusChip status={reg.status} label={tReg(`status.${reg.status}`)} domain="registration" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{reg.notes || '—'}</td>
                  <td className="px-4 py-3">
                    {reg.status !== 'WITHDRAWN' && (
                      <button onClick={() => setWithdrawId(reg.id)} className="text-[13px] font-medium text-red-500 hover:underline">
                        {t('withdraw')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add registration modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addRegistration')}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">{t('pickAthlete')}</label>
            <select
              value={selectedAthleteId}
              onChange={(e) => setSelectedAthleteId(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            >
              <option value="">—</option>
              {athletes?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}{a.dateOfBirth ? ` (${new Date(a.dateOfBirth).getFullYear()})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">{t('pickCategory')}</label>
            <CategoryPicker
              eventSlug={eventSlug}
              ageGroupId={selectedAgeGroupId}
              weightCategoryId={eventWeightCategoryId}
              onAgeGroupChange={setSelectedAgeGroupId}
              onWeightCategoryChange={setEventWeightCategoryId}
              disabled={createMut.isPending}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">{t('notesOptional')}</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setAddOpen(false)}>{tC('cancel')}</SecondaryButton>
            <button onClick={handleAdd} disabled={!selectedAthleteId || !eventWeightCategoryId || createMut.isPending}
              className="h-10 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-70"
            >
              {createMut.isPending ? tC('loading') : tC('save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Withdraw confirmation modal */}
      <Modal open={!!withdrawId} onClose={() => setWithdrawId(null)} title={t('withdraw')}>
        <div className="space-y-4">
          <p className="text-[14px] text-[var(--color-text-muted)]">{t('withdrawConfirm')}</p>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">{t('withdrawReason')}</label>
            <input type="text" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setWithdrawId(null)}>{tC('cancel')}</SecondaryButton>
            <button onClick={handleWithdraw} disabled={statusMut.isPending}
              className="h-10 rounded-[var(--radius-input)] bg-red-600 px-4 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-70"
            >
              {statusMut.isPending ? tC('loading') : t('withdraw')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
