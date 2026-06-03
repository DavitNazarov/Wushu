'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Building2, Plus, Search, Users } from 'lucide-react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { AdminFilterSelect } from '@/components/admin/AdminFilterSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/primitives/input';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { localizedName } from '@/lib/bilingual';
import type { AthleteRow, ClubRow } from '@/types/api';

import {
  ATHLETES_CARD_CLASS,
  EMPTY_ATHLETE_FORM,
  PAGE_SIZE,
  type AthleteFormState,
} from './athletes.types';
import { getDuplicateCount, isGeorgianClub, toDateInput } from './athletes.utils';
import { AthleteStatCard } from './components/AthleteStatCard';
import { AthleteFormModal } from './components/AthleteFormModal';
import { AthletesDesktopTable } from './components/AthletesDesktopTable';
import { AthletesMobileList } from './components/AthletesMobileList';
import { AthletesPagination } from './components/AthletesPagination';

export default function AthletesPage() {
  const t = useTranslations('athletes');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('athleteProfile.identity');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<AthleteRow | null>(null);
  const [form, setForm] = useState<AthleteFormState>(EMPTY_ATHLETE_FORM);
  const [docIdError, setDocIdError] = useState<string | null>(null);

  function setSearchAndReset(v: string) { setSearch(v); setPage(1); }
  function setClubAndReset(v: string) { setSelectedClubId(v); setPage(1); }

  const athleteQueryPath = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (selectedClubId) params.set('clubId', selectedClubId);
    const query = params.toString();
    return query ? `/api/athletes?${query}` : '/api/athletes';
  }, [search, selectedClubId]);

  const { data: athletes, isLoading, error, refetch } = useQuery({
    queryKey: ['athletes', search, selectedClubId],
    queryFn: () => apiGet<AthleteRow[]>(athleteQueryPath),
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });

  const clubMap = useMemo(() => new Map((clubs ?? []).map((c) => [c.id, c])), [clubs]);
  const formClub = form.clubId ? (clubMap.get(form.clubId) ?? null) : null;
  const showKaFields = isGeorgianClub(formClub);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<{ athlete: AthleteRow }>('/api/athletes', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
      toast(tCommon('saveSuccess'));
      closeModal();
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.code === 'DOCUMENT_ID_ALREADY_EXISTS') {
        setDocIdError(t('errors.documentIdExists'));
        return;
      }
      toast(e instanceof Error ? e.message : tCommon('saveFailed'), 'error');
    },
  });

  function openNew() {
    setEditingAthlete(null);
    setForm(EMPTY_ATHLETE_FORM);
    setDocIdError(null);
    setModalOpen(true);
  }

  function openEdit(a: AthleteRow) {
    setEditingAthlete(a);
    setForm({
      firstName: a.firstName,
      lastName: a.lastName,
      firstNameKa: a.firstNameKa ?? '',
      lastNameKa: a.lastNameKa ?? '',
      dateOfBirth: toDateInput(a.dateOfBirth),
      documentId: a.documentId ?? '',
      sex: a.sex ?? '',
      clubId: a.clubId ?? '',
    });
    setDocIdError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingAthlete(null);
    setForm(EMPTY_ATHLETE_FORM);
    setDocIdError(null);
  }

  function handleSave() {
    setDocIdError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) return;
    if (!form.documentId.trim()) {
      setDocIdError(t('errors.documentIdRequired'));
      return;
    }

    const body: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      // Preserve KA names regardless of form visibility — moving an athlete
      // out of a Georgian club shouldn't destroy their existing KA spelling.
      firstNameKa: form.firstNameKa.trim() || null,
      lastNameKa: form.lastNameKa.trim() || null,
      dateOfBirth: form.dateOfBirth,
      documentId: form.documentId.trim(),
      sex: form.sex || undefined,
      clubId: form.clubId || undefined,
    };

    if (editingAthlete) body.id = editingAthlete.id;
    saveMutation.mutate(body);
  }

  const formValid =
    !!form.firstName.trim() &&
    !!form.lastName.trim() &&
    !!form.dateOfBirth &&
    !!form.documentId.trim();

  const rows = athletes ?? [];
  const unassignedCount = rows.filter((a) => !a.clubId).length;
  const linkedClubCount = rows.length - unassignedCount;
  const duplicateReviewCount = rows.filter((a) => getDuplicateCount(a) > 1).length;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function getClub(athlete: AthleteRow) {
    if (athlete.club) return athlete.club;
    if (!athlete.clubId) return null;
    return clubMap.get(athlete.clubId) ?? null;
  }

  function getClubLabel(athlete: AthleteRow) {
    const club = getClub(athlete);
    if (!club) return t('badges.missingClub');
    return localizedName(club.name, club.nameKa, locale);
  }

  function getClubMeta(athlete: AthleteRow) {
    const club = getClub(athlete);
    return [club?.city, club?.country].filter(Boolean).join(', ') || null;
  }

  function getSexLabel(athlete: AthleteRow) {
    if (!athlete.sex) return t('details.unspecified');
    return tProfile(`sexValue.${athlete.sex}`);
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={
            <PrimaryButton onClick={openNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t('new')}
            </PrimaryButton>
          }
        />
      </motion.div>

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      <motion.div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <AthleteStatCard label={t('stats.total')} value={rows.length} icon={Users} hint={t('stats.totalHint')} />
        <AthleteStatCard label={t('stats.linked')} value={linkedClubCount} icon={Building2} hint={t('stats.linkedHint')} />
        <AthleteStatCard label={t('stats.needsClub')} value={unassignedCount} icon={AlertTriangle} tone={unassignedCount > 0 ? 'warning' : 'neutral'} hint={t('stats.needsClubHint')} />
        <AthleteStatCard label={t('stats.duplicates')} value={duplicateReviewCount} icon={AlertTriangle} tone={duplicateReviewCount > 0 ? 'warning' : 'neutral'} hint={t('stats.duplicatesHint')} />
      </motion.div>

      <motion.div
        className={`${ATHLETES_CARD_CLASS} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <Input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearchAndReset(e.target.value)}
            className="h-10 w-full bg-[var(--color-surface)] pl-9"
          />
        </div>
        <AdminFilterSelect
          label={t('columns.club')}
          value={selectedClubId}
          emptyLabel={t('filters.allClubs')}
          options={(clubs ?? []).map((c) => ({ value: c.id, label: localizedName(c.name, c.nameKa, locale) }))}
          onValueChange={setClubAndReset}
          className="sm:min-w-[200px]"
        />
      </motion.div>

      {isLoading ? (
        <SkeletonRows rows={10} cols={4} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="space-y-3">
          <AthletesDesktopTable
            rows={pageRows}
            pageKey={safePage}
            locale={locale}
            onEdit={openEdit}
            getClubLabel={getClubLabel}
            getClubMeta={getClubMeta}
            getSexLabel={getSexLabel}
          />
          <AthletesMobileList
            rows={pageRows}
            pageKey={safePage}
            locale={locale}
            onEdit={openEdit}
            getClubLabel={getClubLabel}
            getSexLabel={getSexLabel}
          />
          <AthletesPagination
            page={safePage}
            totalPages={totalPages}
            totalRows={rows.length}
            onPageChange={setPage}
          />
        </div>
      )}

      <AthleteFormModal
        open={modalOpen}
        onClose={closeModal}
        editingAthlete={editingAthlete}
        form={form}
        setForm={setForm}
        clubs={clubs ?? []}
        showKaFields={showKaFields}
        docIdError={docIdError}
        setDocIdError={setDocIdError}
        formValid={formValid}
        saving={saveMutation.isPending}
        onSave={handleSave}
        locale={locale}
      />
    </div>
  );
}
