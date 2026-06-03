'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { publicVariants } from '@/lib/animations/variants';
import type { EventRow, RegistrationRow, AthleteRow } from '@/types/api';

import { formatDate, PAGE_SIZE } from './registrations.utils';
import { EventSubNav } from './components/EventSubNav';
import { RegistrationsHeader } from './components/RegistrationsHeader';
import { RegistrationsList } from './components/RegistrationsList';
import { AddRegistrationModal } from './components/AddRegistrationModal';
import { EditRegistrationModal } from './components/EditRegistrationModal';
import { WithdrawModal } from './components/WithdrawModal';

type Props = { params: Promise<{ locale: string; eventSlug: string }> };

export default function CoachRegistrationsPage({ params }: Props) {
  const { locale, eventSlug } = use(params);
  const t = useTranslations('coach.registrations');
  const tReg = useTranslations('registrations');
  const tC = useTranslations('common');
  const qc = useQueryClient();
  const { toast } = useToast();

  // Add state
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState('');
  const [eventWeightCategoryId, setEventWeightCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [regClosedError, setRegClosedError] = useState(false);

  // Edit state
  const [editReg, setEditReg] = useState<RegistrationRow | null>(null);
  const [editAgeGroupId, setEditAgeGroupId] = useState('');
  const [editWeightCategoryId, setEditWeightCategoryId] = useState('');

  // Withdraw state
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

  // Pagination
  const [page, setPage] = useState(1);

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

  const allRows = regs ?? [];
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = allRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedAthlete = athletes?.find((a) => a.id === selectedAthleteId) ?? null;
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

  function handleAdd() {
    if (!eventId || !selectedAthleteId || !eventWeightCategoryId || alreadyRegistered) return;
    createMut.mutate({ eventId, athleteId: selectedAthleteId, eventWeightCategoryId, notes: notes.trim() || undefined });
  }

  function handleEditSave() {
    if (!editReg || !editWeightCategoryId) return;
    categoryMut.mutate({ id: editReg.id, eventWeightCategoryId: editWeightCategoryId });
  }

  function handleWithdraw() {
    if (!withdrawId) return;
    statusMut.mutate({ id: withdrawId, status: 'WITHDRAWN', reason: withdrawReason.trim() || undefined });
  }

  return (
    <motion.div
      className="space-y-8 py-2"
      variants={publicVariants.staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={publicVariants.staggerItem}>
        <Link
          href={`/${locale}/coach/events`}
          className="group inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
          {tC('back')}
        </Link>
      </motion.div>

      <RegistrationsHeader
        event={event}
        eventSlug={eventSlug}
        locale={locale}
        eventLoading={eventLoading}
        regStatus={regStatus}
        isRegOpen={isRegOpen}
        hasEventId={!!eventId}
        onAdd={() => { setRegClosedError(false); setAddOpen(true); }}
      />

      <EventSubNav eventSlug={eventSlug} locale={locale} />

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
          <RegistrationsList
            allRows={allRows}
            pagedRows={pagedRows}
            locale={locale}
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            onEdit={openEdit}
          />
        )}
      </motion.div>

      <AddRegistrationModal
        open={addOpen}
        onClose={closeAdd}
        eventSlug={eventSlug}
        locale={locale}
        athletes={athletes}
        allRows={allRows}
        selectedAthleteId={selectedAthleteId}
        selectedAgeGroupId={selectedAgeGroupId}
        eventWeightCategoryId={eventWeightCategoryId}
        notes={notes}
        selectedAthlete={selectedAthlete}
        alreadyRegistered={alreadyRegistered}
        saving={createMut.isPending}
        onAthleteChange={handleAthleteChange}
        onAgeGroupChange={setSelectedAgeGroupId}
        onWeightCategoryChange={setEventWeightCategoryId}
        onNotesChange={setNotes}
        onSave={handleAdd}
      />

      <EditRegistrationModal
        reg={editReg}
        onClose={closeEdit}
        eventSlug={eventSlug}
        locale={locale}
        ageGroupId={editAgeGroupId}
        weightCategoryId={editWeightCategoryId}
        saving={categoryMut.isPending}
        onAgeGroupChange={setEditAgeGroupId}
        onWeightCategoryChange={setEditWeightCategoryId}
        onSave={handleEditSave}
        onWithdraw={() => { closeEdit(); setWithdrawId(editReg?.id ?? null); }}
      />

      <WithdrawModal
        open={!!withdrawId}
        onClose={() => setWithdrawId(null)}
        reason={withdrawReason}
        saving={statusMut.isPending}
        onReasonChange={setWithdrawReason}
        onConfirm={handleWithdraw}
      />
    </motion.div>
  );
}
