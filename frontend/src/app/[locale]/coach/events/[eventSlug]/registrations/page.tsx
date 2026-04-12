'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, GitBranch, Clock, Radio } from 'lucide-react';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Label } from '@/components/ui/primitives/label';
import { Input } from '@/components/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { publicVariants } from '@/lib/animations/variants';
import type { EventRow, RegistrationRow, AthleteRow } from '@/types/api';
import { CategoryPicker } from '@/components/registration/CategoryPicker';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

const PAGE_SIZE = 10;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function athleteInitials(reg: RegistrationRow): string {
  if (!reg.athlete) return '?';
  return `${reg.athlete.firstName[0]}${reg.athlete.lastName[0]}`.toUpperCase();
}

function athleteName(reg: RegistrationRow): string {
  if (!reg.athlete) return reg.athleteId;
  const year = reg.athlete.dateOfBirth ? ` (${new Date(reg.athlete.dateOfBirth).getFullYear()})` : '';
  return `${reg.athlete.firstName} ${reg.athlete.lastName}${year}`;
}

const SUB_NAV = [
  { key: 'brackets', href: (slug: string, locale: string) => `/${locale}/coach/events/${slug}/brackets`, icon: GitBranch },
  { key: 'schedule', href: (slug: string, locale: string) => `/${locale}/coach/events/${slug}/schedule`, icon: Clock },
  { key: 'live', href: (slug: string, locale: string) => `/${locale}/coach/events/${slug}/live`, icon: Radio },
];

const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]';

export default function CoachRegistrationsPage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const t = useTranslations('coach.registrations');
  const tReg = useTranslations('registrations');
  const tC = useTranslations('common');
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Add registration state ─────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState('');
  const [eventWeightCategoryId, setEventWeightCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [regClosedError, setRegClosedError] = useState(false);

  // ── Edit registration state ────────────────────────────────────────────────
  const [editReg, setEditReg] = useState<RegistrationRow | null>(null);
  const [editAgeGroupId, setEditAgeGroupId] = useState('');
  const [editWeightCategoryId, setEditWeightCategoryId] = useState('');

  // ── Withdraw state ─────────────────────────────────────────────────────────
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Queries ────────────────────────────────────────────────────────────────
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

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (body: { eventId: string; athleteId: string; eventWeightCategoryId: string; notes?: string }) =>
      apiPost<RegistrationRow>('/api/registrations', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      closeAdd();
      toast(tC('saveSuccess'));
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 403) {
        const code = (e.details as { code?: string } | null)?.code ?? e.message;
        if (code === 'REGISTRATION_CLOSED') {
          setRegClosedError(true);
          closeAdd();
          toast(t('regClosedError'), 'error');
          return;
        }
      }
      toast(e instanceof ApiError ? e.message : tC('error'), 'error');
    },
  });

  const categoryMut = useMutation({
    mutationFn: ({ id, eventWeightCategoryId }: { id: string; eventWeightCategoryId: string }) =>
      apiPost(`/api/registrations/${id}/category`, { eventWeightCategoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      closeEdit();
      toast(tC('saveSuccess'));
    },
    onError: (e: unknown) => toast(e instanceof ApiError ? e.message : tC('error'), 'error'),
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const allRows = regs ?? [];
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = allRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedAthlete = athletes?.find((a) => a.id === selectedAthleteId) ?? null;
  // Check if selected athlete already has an active registration
  const alreadyRegistered = !!selectedAthleteId &&
    allRows.some((r) => r.athleteId === selectedAthleteId && r.status !== 'WITHDRAWN');

  function handleAthleteChange(id: string) {
    setSelectedAthleteId(id);
    setSelectedAgeGroupId('');
    setEventWeightCategoryId('');
  }

  function closeAdd() {
    setAddOpen(false);
    setSelectedAthleteId('');
    setSelectedAgeGroupId('');
    setEventWeightCategoryId('');
    setNotes('');
    setRegClosedError(false);
  }

  function openEdit(reg: RegistrationRow) {
    setEditReg(reg);
    setEditAgeGroupId('');
    setEditWeightCategoryId(reg.eventWeightCategoryId ?? '');
  }

  function closeEdit() {
    setEditReg(null);
    setEditAgeGroupId('');
    setEditWeightCategoryId('');
  }

  const handleAdd = () => {
    if (!eventId || !selectedAthleteId || !eventWeightCategoryId || alreadyRegistered) return;
    createMut.mutate({ eventId, athleteId: selectedAthleteId, eventWeightCategoryId, notes: notes.trim() || undefined });
  };

  const handleEditSave = () => {
    if (!editReg || !editWeightCategoryId) return;
    categoryMut.mutate({ id: editReg.id, eventWeightCategoryId: editWeightCategoryId });
  };

  const handleWithdraw = () => {
    if (!withdrawId) return;
    statusMut.mutate({ id: withdrawId, status: 'WITHDRAWN', reason: withdrawReason.trim() || undefined });
  };

  return (
    <motion.div
      className="space-y-8 py-2"
      variants={publicVariants.staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Back */}
      <motion.div variants={publicVariants.staggerItem}>
        <Link
          href={`/${locale}/coach/events`}
          className="group inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
          {tC('back')}
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div variants={publicVariants.staggerItem}>
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
                    {t(`regStatus.${regStatus}`)}
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
      </motion.div>

      {/* Event sub-nav */}
      <motion.div className="flex flex-wrap gap-1" variants={publicVariants.staggerItem}>
        {SUB_NAV.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href(eventSlug, locale)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
          >
            <Icon className="h-3 w-3" />
            {t(`nav.${key}`)}
          </Link>
        ))}
      </motion.div>

      {/* Registration window banner */}
      {event && regStatus && (
        <motion.div variants={publicVariants.staggerItem}>
          <InlineAlert variant={regStatus === 'OPEN' ? 'success' : regStatus === 'UPCOMING' ? 'warning' : 'error'}>
            {regStatus === 'UPCOMING' && t('regStatusUpcoming', { date: formatDate(event.registrationOpensAt) })}
            {regStatus === 'OPEN' && t('regStatusOpen', { date: formatDate(event.registrationClosesAt) })}
            {regStatus === 'CLOSED' && t('regStatusClosed')}
          </InlineAlert>
        </motion.div>
      )}

      {regClosedError && (
        <motion.div variants={publicVariants.staggerItem}>
          <InlineAlert variant="error">{t('regClosedError')}</InlineAlert>
        </motion.div>
      )}

      {error && (
        <motion.div variants={publicVariants.staggerItem}>
          <InlineAlert variant="error" actions={<button onClick={() => refetch()} className="text-[13px] font-medium underline">{tC('retry')}</button>}>
            {tC('loadError')}
          </InlineAlert>
        </motion.div>
      )}

      {/* List */}
      <motion.div variants={publicVariants.staggerItem}>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="56px" className="w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : allRows.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center">
            <p className="text-[14px] font-medium text-[var(--color-text)]">{t('emptyTitle')}</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('emptyDescription')}</p>
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              {t('title')} <span className="ml-1 font-normal normal-case tracking-normal">({allRows.length})</span>
            </h2>

            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              {pagedRows.map((reg, i) => (
                <div
                  key={reg.id}
                  onClick={() => reg.status !== 'WITHDRAWN' && openEdit(reg)}
                  className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${
                    i !== 0 ? 'border-t border-[var(--color-border)]' : ''
                  } bg-[var(--color-surface)] ${reg.status !== 'WITHDRAWN' ? 'cursor-pointer hover:bg-[var(--color-surface-alt)]' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[11px] font-semibold text-[var(--color-text-muted)]">
                      {athleteInitials(reg)}
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
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 min-w-[32px] rounded-[var(--radius-input)] border px-2.5 text-[13px] font-medium transition ${
                      p === safePage
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        )}
      </motion.div>

      {/* Add registration modal */}
      <Modal open={addOpen} onClose={closeAdd} title={t('addRegistration')}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className={LABEL}>{t('pickAthlete')}</Label>
            <Select value={selectedAthleteId} onValueChange={handleAthleteChange}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {athletes?.map((a) => {
                  const reg = allRows.find((r) => r.athleteId === a.id && r.status !== 'WITHDRAWN');
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span>
                          {a.firstName} {a.lastName}{a.dateOfBirth ? ` (${new Date(a.dateOfBirth).getFullYear()})` : ''}
                        </span>
                        {reg && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                            {reg.categoryCode}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Already registered warning — blocks submission */}
          {alreadyRegistered && (
            <div className="rounded-[var(--radius-input)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-3 py-2.5 text-[13px] text-[var(--color-warning)]">
              {selectedAthlete
                ? `${selectedAthlete.firstName} ${selectedAthlete.lastName} is already registered for this event.`
                : 'This athlete is already registered for this event.'}
            </div>
          )}

          {!alreadyRegistered && (
            <>
              <div className="space-y-1.5">
                <Label className={LABEL}>{t('pickCategory')}</Label>
                <CategoryPicker
                  eventSlug={eventSlug}
                  ageGroupId={selectedAgeGroupId}
                  weightCategoryId={eventWeightCategoryId}
                  onAgeGroupChange={setSelectedAgeGroupId}
                  onWeightCategoryChange={setEventWeightCategoryId}
                  disabled={createMut.isPending}
                  athlete={selectedAthlete}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={LABEL}>{t('notesOptional')}</Label>
                <Input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={closeAdd}>{tC('cancel')}</SecondaryButton>
            <button
              onClick={handleAdd}
              disabled={!selectedAthleteId || !eventWeightCategoryId || alreadyRegistered || createMut.isPending}
              className="h-9 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              {createMut.isPending ? tC('loading') : tC('save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit registration modal */}
      <Modal open={!!editReg} onClose={closeEdit} title={editReg ? athleteName(editReg) : ''}>
        {editReg && (
          <div className="space-y-4">
            {/* Current registration info */}
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[12px] font-semibold uppercase text-[var(--color-primary)]">
                {athleteInitials(editReg)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--color-text)]">{athleteName(editReg)}</p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                  {editReg.categoryCode} · <StatusChip status={editReg.status} label={tReg(`status.${editReg.status}`)} domain="registration" />
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={LABEL}>{t('pickCategory')}</Label>
              <CategoryPicker
                eventSlug={eventSlug}
                ageGroupId={editAgeGroupId}
                weightCategoryId={editWeightCategoryId}
                onAgeGroupChange={setEditAgeGroupId}
                onWeightCategoryChange={setEditWeightCategoryId}
                disabled={categoryMut.isPending}
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={(e) => { e.preventDefault(); closeEdit(); setWithdrawId(editReg.id); }}
                className="text-[12px] font-medium text-[var(--color-danger,#ef4444)] opacity-70 hover:opacity-100"
              >
                {t('withdraw')}
              </button>
              <div className="flex gap-2">
                <SecondaryButton onClick={closeEdit}>{tC('cancel')}</SecondaryButton>
                <button
                  onClick={handleEditSave}
                  disabled={!editWeightCategoryId || categoryMut.isPending}
                  className="h-9 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                >
                  {categoryMut.isPending ? tC('loading') : tC('save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Withdraw confirmation modal */}
      <Modal open={!!withdrawId} onClose={() => setWithdrawId(null)} title={t('withdraw')}>
        <div className="space-y-4">
          <p className="text-[14px] text-[var(--color-text-muted)]">{t('withdrawConfirm')}</p>
          <div className="space-y-1.5">
            <Label className={LABEL}>{t('withdrawReason')}</Label>
            <Input type="text" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
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
    </motion.div>
  );
}
