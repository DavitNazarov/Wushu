'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import type { EventRow, RegistrationRow, AthleteRow } from '@/types/api';
import { CategoryPicker } from '@/components/registration/CategoryPicker';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

const INPUT_CLS =
  'mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function athleteInitial(reg: RegistrationRow): string {
  return reg.athlete ? reg.athlete.firstName.slice(0, 1).toUpperCase() : '?';
}

function athleteName(reg: RegistrationRow): string {
  return reg.athlete ? `${reg.athlete.firstName} ${reg.athlete.lastName}` : reg.athleteId;
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

  const navLinks = [
    { href: `/${locale}/coach/events/${eventSlug}/brackets`, label: 'Brackets' },
    { href: `/${locale}/coach/events/${eventSlug}/schedule`, label: 'Schedule' },
    { href: `/${locale}/coach/events/${eventSlug}/live`, label: 'Live' },
  ];

  return (
    <div className="space-y-8 py-2">

      {/* Back */}
      <Link
        href={`/${locale}/coach/events`}
        className="group inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <svg className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Events
      </Link>

      {/* Header */}
      {eventLoading ? (
        <div className="space-y-2">
          <Skeleton width="50%" height="28px" />
          <Skeleton width="30%" height="16px" />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              {event?.name ?? eventSlug}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="text-[13px] text-[var(--color-text-muted)]">{t('title')}</p>
              {event && regStatus && (
                <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  regStatus === 'OPEN'
                    ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                    : regStatus === 'UPCOMING'
                      ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                }`}>
                  {regStatus === 'UPCOMING' && 'Reg. upcoming'}
                  {regStatus === 'OPEN' && 'Reg. open'}
                  {regStatus === 'CLOSED' && 'Reg. closed'}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => { setRegClosedError(false); setAddOpen(true); }}
            disabled={!eventId || !isRegOpen}
            title={!isRegOpen ? t('regStatusClosed') : undefined}
            className="shrink-0 h-9 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + {t('addRegistration')}
          </button>
        </div>
      )}

      {/* Event sub-nav */}
      <div className="flex flex-wrap gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Registration window banner */}
      {event && regStatus && (
        <InlineAlert variant={regStatus === 'OPEN' ? 'success' : regStatus === 'UPCOMING' ? 'warning' : 'error'}>
          {regStatus === 'UPCOMING' && t('regStatusUpcoming', { date: formatDate(event.registrationOpensAt) })}
          {regStatus === 'OPEN' && t('regStatusOpen', { date: formatDate(event.registrationClosesAt) })}
          {regStatus === 'CLOSED' && t('regStatusClosed')}
        </InlineAlert>
      )}

      {regClosedError && (
        <InlineAlert variant="error">{t('regClosedError')}</InlineAlert>
      )}

      {error && (
        <InlineAlert variant="error" actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tC('retry')}</button>}>
          {tC('loadError')}
        </InlineAlert>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="56px" className="w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center">
          <p className="text-[14px] font-medium text-[var(--color-text)]">{t('emptyTitle')}</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('emptyDescription')}</p>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {t('title')} <span className="ml-1 font-normal normal-case tracking-normal">({rows.length})</span>
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
            {rows.map((reg, i) => (
              <div
                key={reg.id}
                className={`flex items-center justify-between gap-4 px-4 py-3 ${
                  i !== 0 ? 'border-t border-[var(--color-border)]' : ''
                } bg-[var(--color-surface)]`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[11px] font-semibold text-[var(--color-text-muted)]">
                    {athleteInitial(reg)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                      {athleteName(reg)}
                    </p>
                    {reg.notes && (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">{reg.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-[12px] text-[var(--color-text-muted)] sm:block">
                    {reg.categoryCode}
                  </span>
                  <StatusChip status={reg.status} label={tReg(`status.${reg.status}`)} domain="registration" />
                  {reg.status !== 'WITHDRAWN' && (
                    <button
                      onClick={() => setWithdrawId(reg.id)}
                      className="text-[12px] font-medium text-[var(--color-danger,#ef4444)] opacity-70 transition-opacity hover:opacity-100"
                    >
                      {t('withdraw')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add registration modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addRegistration')}>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{t('pickAthlete')}</label>
            <select value={selectedAthleteId} onChange={(e) => setSelectedAthleteId(e.target.value)} className={INPUT_CLS}>
              <option value="">—</option>
              {athletes?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}{a.dateOfBirth ? ` (${new Date(a.dateOfBirth).getFullYear()})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{t('pickCategory')}</label>
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{t('notesOptional')}</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT_CLS} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={() => setAddOpen(false)}>{tC('cancel')}</SecondaryButton>
            <button
              onClick={handleAdd}
              disabled={!selectedAthleteId || !eventWeightCategoryId || createMut.isPending}
              className="h-9 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{t('withdrawReason')}</label>
            <input type="text" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} className={INPUT_CLS} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={() => setWithdrawId(null)}>{tC('cancel')}</SecondaryButton>
            <button
              onClick={handleWithdraw}
              disabled={statusMut.isPending}
              className="h-9 rounded-[var(--radius-input)] bg-[var(--color-danger,#ef4444)] px-4 text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
            >
              {statusMut.isPending ? tC('loading') : t('withdraw')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
