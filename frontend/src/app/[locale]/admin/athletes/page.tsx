'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { AdminFilterSelect } from '@/components/admin/AdminFilterSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { localizedFullName, localizedName } from '@/lib/bilingual';
import type { AthleteRow, ClubRow } from '@/types/api';

const PAGE_SIZE = 10;
const EMPTY_SEX = '__empty_sex__';
const EMPTY_CLUB = '__empty_club__';

const CARD_CLASS =
  'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const rowItem = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'warning';
  icon: typeof Users;
  hint: string;
};

function StatCard({ label, value, tone = 'neutral', icon: Icon, hint }: StatCardProps) {
  const iconColor = tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-primary)]';
  const valueColor = tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-[var(--color-primary)]';
  return (
    <motion.div
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 transition-shadow"
      whileHover={{ y: -2, boxShadow: '0 6px 24px -6px rgba(0,0,0,0.18)' }}
      transition={{ duration: 0.15 }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-alt)] transition-colors group-hover:bg-[var(--color-primary-subtle)]">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className={`text-[24px] font-bold tabular-nums leading-none tracking-tight ${valueColor}`}>{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]/70">{hint}</p>
      </div>
    </motion.div>
  );
}

type StatusChipProps = { label: string; tone: 'neutral' | 'warning' | 'muted' };
function StatusChip({ label, tone }: StatusChipProps) {
  const cls =
    tone === 'warning' ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
    : tone === 'muted'  ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
    :                     'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function isGeorgianClub(club: ClubRow | null | undefined): boolean {
  if (!club) return false;
  const c = (club.country ?? '').trim().toLowerCase();
  return c === 'ge' || c === 'georgia';
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

type AthleteFormState = {
  firstName: string;
  lastName: string;
  firstNameKa: string;
  lastNameKa: string;
  dateOfBirth: string;
  documentId: string;
  sex: 'MALE' | 'FEMALE' | '';
  clubId: string;
};

const EMPTY_ATHLETE_FORM: AthleteFormState = {
  firstName: '',
  lastName: '',
  firstNameKa: '',
  lastNameKa: '',
  dateOfBirth: '',
  documentId: '',
  sex: '',
  clubId: '',
};

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

  // Modal state
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

  // The club selected in the form (to conditionally show KA fields)
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

  function formatDob(value: string | null | undefined) {
    if (!value) return '—';
    try {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale);
    } catch { return '—'; }
  }

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

  const athleteForm = (
    <div className="space-y-4">
      {/* English name row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{showKaFields ? t('fields.firstNameEn') : t('fields.firstName')} *</Label>
          <Input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{showKaFields ? t('fields.lastNameEn') : t('fields.lastName')} *</Label>
          <Input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
      </div>

      {/* Georgian name row — shown when selected club is Georgian */}
      {showKaFields && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t('fields.firstNameKa')}</Label>
            <Input
              type="text"
              value={form.firstNameKa}
              onChange={(e) => setForm((f) => ({ ...f, firstNameKa: e.target.value }))}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.lastNameKa')}</Label>
            <Input
              type="text"
              value={form.lastNameKa}
              onChange={(e) => setForm((f) => ({ ...f, lastNameKa: e.target.value }))}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('fields.dateOfBirth')} *</Label>
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('fields.sex')}</Label>
          <Select
            value={form.sex || EMPTY_SEX}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, sex: v === EMPTY_SEX ? '' : (v as 'MALE' | 'FEMALE') }))
            }
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SEX}>—</SelectItem>
              <SelectItem value="MALE">{t('fields.sexOptions.male')}</SelectItem>
              <SelectItem value="FEMALE">{t('fields.sexOptions.female')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('fields.club')}</Label>
        <Select
          value={form.clubId || EMPTY_CLUB}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, clubId: v === EMPTY_CLUB ? '' : v }))
          }
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_CLUB}>—</SelectItem>
            {(clubs ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{localizedName(c.name, c.nameKa, locale)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t('fields.documentId')} *</Label>
        <Input
          type="text"
          value={form.documentId}
          onChange={(e) => {
            setForm((f) => ({ ...f, documentId: e.target.value }));
            setDocIdError(null);
          }}
          className="h-10 bg-[var(--color-surface)]"
        />
        {docIdError && (
          <p className="text-[12px] text-[var(--color-danger)]">{docIdError}</p>
        )}
      </div>
    </div>
  );

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

      {/* Stats */}
      <motion.div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <StatCard label={t('stats.total')} value={rows.length} icon={Users} hint={t('stats.totalHint')} />
        <StatCard label={t('stats.linked')} value={linkedClubCount} icon={Building2} hint={t('stats.linkedHint')} />
        <StatCard label={t('stats.needsClub')} value={unassignedCount} icon={AlertTriangle} tone={unassignedCount > 0 ? 'warning' : 'neutral'} hint={t('stats.needsClubHint')} />
        <StatCard label={t('stats.duplicates')} value={duplicateReviewCount} icon={AlertTriangle} tone={duplicateReviewCount > 0 ? 'warning' : 'neutral'} hint={t('stats.duplicatesHint')} />
      </motion.div>

      {/* Filters */}
      <motion.div
        className={`${CARD_CLASS} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}
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

      {/* Table / Cards */}
      {isLoading ? (
        <SkeletonRows rows={10} cols={4} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="space-y-3">
          {/* Desktop table */}
          <div className={`${CARD_CLASS} hidden overflow-hidden lg:block`}>
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)]/60 bg-[var(--color-surface-alt)]/40 text-left">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.club')}</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.identity')}</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{t('columns.status')}</th>
                  <th className="w-10 px-5 py-3" />
                </tr>
              </thead>
              <motion.tbody
                key={safePage}
                className="divide-y divide-[var(--color-border)]/50"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {pageRows.map((athlete) => {
                  const duplicateCount = getDuplicateCount(athlete);
                  return (
                    <motion.tr
                      key={athlete.id}
                      variants={rowItem}
                      className="group bg-[var(--color-surface)] cursor-pointer"
                      onClick={() => openEdit(athlete)}
                    >
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <motion.div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)]"
                            whileHover={{ scale: 1.08 }}
                            transition={{ duration: 0.15 }}
                          >
                            {getInitials(athlete)}
                          </motion.div>
                          <div>
                            <p className="font-semibold text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]">
                              {localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale)}
                            </p>
                            <p className="text-[12px] text-[var(--color-text-muted)]">{getSexLabel(athlete)}</p>
                          </div>
                        </div>
                      </td>
                      {/* Club */}
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[var(--color-text)]">{getClubLabel(athlete)}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">{getClubMeta(athlete) ?? '—'}</p>
                      </td>
                      {/* DOB + Document */}
                      <td className="px-5 py-3.5">
                        <p className="text-[var(--color-text)]">{formatDob(athlete.dateOfBirth)}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)]/70">
                          {athlete.documentId || '—'}
                        </p>
                      </td>
                      {/* Status badges */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {duplicateCount > 1 && (
                            <StatusChip tone="warning" label={t('badges.duplicateCount', { count: duplicateCount })} />
                          )}
                          {!athlete.clubId && <StatusChip tone="warning" label={t('badges.missingClub')} />}
                        </div>
                      </td>
                      {/* Arrow */}
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/${locale}/admin/athletes/${athlete.id}`}>
                          <ChevronRight className="h-4 w-4 text-[var(--color-primary)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <motion.div key={`mobile-${safePage}`} className="space-y-2 lg:hidden" variants={container} initial="hidden" animate="show">
            {pageRows.map((athlete) => {
              const duplicateCount = getDuplicateCount(athlete);
              return (
                <motion.div
                  key={athlete.id}
                  variants={rowItem}
                  whileHover={{ y: -2, boxShadow: '0 6px 20px -6px rgba(0,0,0,0.18)' }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(athlete)}
                    className={`${CARD_CLASS} group flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--color-surface-alt)]/30`}
                  >
                    <motion.div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)]"
                      whileHover={{ scale: 1.08 }}
                      transition={{ duration: 0.15 }}
                    >
                      {getInitials(athlete)}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale)}</p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{getClubLabel(athlete)} · {getSexLabel(athlete)}</p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{formatDob(athlete.dateOfBirth)}</p>
                      {(duplicateCount > 1 || !athlete.clubId) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {duplicateCount > 1 && <StatusChip tone="warning" label={t('badges.duplicateCount', { count: duplicateCount })} />}
                          {!athlete.clubId && <StatusChip tone="warning" label={t('badges.missingClub')} />}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1 pt-1">
              <p className="text-[12px] text-[var(--color-text-muted)]">
                {t('pagination.showing', {
                  from: (safePage - 1) * PAGE_SIZE + 1,
                  to: Math.min(safePage * PAGE_SIZE, rows.length),
                  total: rows.length,
                })}
              </p>
              <div className="flex items-center gap-1">
                <motion.button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ duration: 0.12 }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </motion.button>

                {getPaginationPages(safePage, totalPages).map((item, i) =>
                  item === '…' ? (
                    <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-[12px] text-[var(--color-text-muted)]">…</span>
                  ) : (
                    <motion.button
                      key={item}
                      type="button"
                      onClick={() => setPage(item as number)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ duration: 0.12 }}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-medium transition-colors ${
                        item === safePage
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)]'
                      }`}
                    >
                      {item}
                    </motion.button>
                  )
                )}

                <motion.button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ duration: 0.12 }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit athlete modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingAthlete
          ? localizedFullName(editingAthlete.firstName, editingAthlete.lastName, editingAthlete.firstNameKa, editingAthlete.lastNameKa, locale)
          : t('new')}
        footer={
          <>
            <SecondaryButton onClick={closeModal}>{tCommon('cancel')}</SecondaryButton>
            <PrimaryButton
              disabled={!formValid || saveMutation.isPending}
              onClick={handleSave}
            >
              {saveMutation.isPending ? tCommon('loading') : tCommon('save')}
            </PrimaryButton>
          </>
        }
      >
        {editingAthlete && (
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={`/${locale}/admin/athletes/${editingAthlete.id}`}
              onClick={closeModal}
              className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:underline"
            >
              {t('viewProfile')} →
            </Link>
          </div>
        )}
        {athleteForm}
      </Modal>
    </div>
  );
}

function getDuplicateCount(athlete: AthleteRow) {
  return athlete.duplicateCount ?? athlete._dedupeCount ?? 0;
}

function getInitials(athlete: AthleteRow) {
  return `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`.toUpperCase();
}

function getPaginationPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
