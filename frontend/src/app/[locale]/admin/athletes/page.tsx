'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRightLeft, Building2, CalendarDays, ChevronRight, FileBadge2, Search, Users } from 'lucide-react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { AdminFilterSelect } from '@/components/admin/AdminFilterSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/primitives/input';
import { getCompactErrorMessage } from '@/lib/api/error';
import { apiGet, apiPost } from '@/lib/api/client';
import type { AthleteRow, ClubRow } from '@/types/api';

const CARD_CLASS =
  'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const rowItem = {
  hidden: { opacity: 0, y: 5 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'warning';
  icon: typeof Users;
  hint: string;
};

function StatCard({ label, value, tone = 'neutral', icon: Icon, hint }: StatCardProps) {
  const iconClass =
    tone === 'warning'
      ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
      : 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';

  return (
    <motion.div
      className="group flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-md"
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-xl opacity-80 group-hover:opacity-100 transition-opacity ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</p>
      <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>
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

export default function AthletesPage() {
  const t = useTranslations('athletes');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('athleteProfile.identity');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeReason, setMergeReason] = useState('');

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

  const rows = athletes ?? [];
  const selectedAthletes = rows.filter((a) => selectedIds.includes(a.id));
  const selectedNames = selectedAthletes.map((a) => `${a.lastName} ${a.firstName}`);
  const unassignedCount = rows.filter((a) => !a.clubId).length;
  const linkedClubCount = rows.length - unassignedCount;
  const duplicateReviewCount = rows.filter((a) => getDuplicateCount(a) > 1).length;
  const canMerge = selectedIds.length === 2;

  const mergeMutation = useMutation({
    mutationFn: () => apiPost<AthleteRow>('/api/athletes/merge', {
      primaryId: selectedIds[0],
      secondaryId: selectedIds[1],
      reason: mergeReason.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
      toast(tCommon('saveSuccess'));
      setSelectedIds([]);
      setMergeOpen(false);
      setMergeReason('');
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('merge.errorGeneric')), 'error'),
  });

  function toggleSelected(id: string) {
    setSelectedIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-2));
  }

  function openMerge() {
    if (!canMerge) return;
    setMergeReason('');
    setMergeOpen(true);
  }

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
    return getClub(athlete)?.name ?? t('badges.missingClub');
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
            <PrimaryButton disabled={!canMerge} onClick={openMerge}>
              <ArrowRightLeft className="mr-1.5 h-4 w-4" />
              {t('merge.button')}
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
        <StatCard label={t('stats.duplicates')} value={duplicateReviewCount} icon={ArrowRightLeft} tone={duplicateReviewCount > 0 ? 'warning' : 'neutral'} hint={t('stats.duplicatesHint')} />
      </motion.div>

      {/* Filters + Merge panel */}
      <motion.div
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {/* Search + club filter */}
        <div className={`${CARD_CLASS} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full bg-[var(--color-surface)] pl-9"
            />
          </div>
          <AdminFilterSelect
            label={t('columns.club')}
            value={selectedClubId}
            emptyLabel={t('filters.allClubs')}
            options={(clubs ?? []).map((c) => ({ value: c.id, label: c.name }))}
            onValueChange={setSelectedClubId}
            className="sm:min-w-[180px]"
          />
        </div>

        {/* Merge widget */}
        <div className={`${CARD_CLASS} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[var(--color-text)]">{t('selection.title')}</p>
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-primary)]">
              {selectedIds.length}/2
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {selectedNames.length > 0 ? (
              selectedNames.map((name, i) => (
                <div key={`${name}-${i}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    {t('selection.slotLabel', { index: i + 1 })}
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium text-[var(--color-text)]">{name}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-3 text-[12px] text-[var(--color-text-muted)]">
                {t('selection.empty')}
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <PrimaryButton disabled={!canMerge} onClick={openMerge}>{t('merge.button')}</PrimaryButton>
            <SecondaryButton disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>{t('selection.clear')}</SecondaryButton>
          </div>
        </div>
      </motion.div>

      {/* Table / Cards */}
      {isLoading ? (
        <SkeletonRows rows={6} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          {/* Desktop table */}
          <div className={`${CARD_CLASS} hidden overflow-hidden lg:block`}>
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)]/60 bg-[var(--color-surface-alt)]/50 text-left">
                  <th className="w-12 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{t('columns.select')}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{t('columns.club')}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{t('columns.identity')}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{t('columns.status')}</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{t('columns.actions')}</th>
                </tr>
              </thead>
              <motion.tbody
                className="divide-y divide-[var(--color-border)]/50"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {rows.map((athlete) => {
                  const selected = selectedIds.includes(athlete.id);
                  const duplicateCount = getDuplicateCount(athlete);
                  return (
                    <motion.tr
                      key={athlete.id}
                      variants={rowItem}
                      onClick={() => toggleSelected(athlete.id)}
                      className={`cursor-pointer transition-colors hover:bg-[var(--color-surface-alt)]/50 ${selected ? 'bg-[var(--color-primary-subtle)]/30' : 'bg-[var(--color-surface)]'}`}
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelected(athlete.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[12px] font-bold uppercase text-[var(--color-primary)]">
                            {getInitials(athlete)}
                          </div>
                          <div>
                            <Link
                              href={`/${locale}/admin/athletes/${athlete.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[14px] font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline transition-colors"
                            >
                              {athlete.lastName} {athlete.firstName}
                            </Link>
                            <p className="text-[12px] text-[var(--color-text-muted)]">{getSexLabel(athlete)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[var(--color-text)]">{getClubLabel(athlete)}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">{getClubMeta(athlete) ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-1 text-[12px] text-[var(--color-text-muted)]">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDob(athlete.dateOfBirth)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FileBadge2 className="h-3.5 w-3.5" />
                            {athlete.documentId ?? t('badges.missingDocument')}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          <StatusChip
                            tone={duplicateCount > 1 ? 'warning' : 'neutral'}
                            label={duplicateCount > 1 ? t('badges.duplicateCount', { count: duplicateCount }) : t('badges.noDuplicates')}
                          />
                          {!athlete.clubId && <StatusChip tone="warning" label={t('badges.missingClub')} />}
                          {!athlete.documentId && <StatusChip tone="muted" label={t('badges.missingDocument')} />}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/${locale}/admin/athletes/${athlete.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {t('actions.viewProfile')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <motion.div className="space-y-2 lg:hidden" variants={container} initial="hidden" animate="show">
            {rows.map((athlete) => {
              const selected = selectedIds.includes(athlete.id);
              const duplicateCount = getDuplicateCount(athlete);

              return (
                <motion.button
                  key={athlete.id}
                  type="button"
                  variants={rowItem}
                  onClick={() => toggleSelected(athlete.id)}
                  className={`${CARD_CLASS} w-full p-4 text-left transition-colors ${selected ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary-subtle)]/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(athlete.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/${locale}/admin/athletes/${athlete.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[14px] font-semibold text-[var(--color-text)] hover:underline"
                        >
                          {athlete.lastName} {athlete.firstName}
                        </Link>
                        <span className="rounded-xl bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)]">
                          {getInitials(athlete)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{getSexLabel(athlete)}</p>
                      <div className="mt-2 grid gap-1 text-[12px] text-[var(--color-text-muted)]">
                        <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{getClubLabel(athlete)}</div>
                        <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDob(athlete.dateOfBirth)}</div>
                        <div className="flex items-center gap-1.5"><FileBadge2 className="h-3.5 w-3.5" />{athlete.documentId ?? t('badges.missingDocument')}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusChip tone={duplicateCount > 1 ? 'warning' : 'neutral'} label={duplicateCount > 1 ? t('badges.duplicateCount', { count: duplicateCount }) : t('badges.noDuplicates')} />
                        {!athlete.clubId && <StatusChip tone="warning" label={t('badges.missingClub')} />}
                        {!athlete.documentId && <StatusChip tone="muted" label={t('badges.missingDocument')} />}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </>
      )}

      {/* Merge modal */}
      <Modal
        open={mergeOpen && canMerge}
        onClose={() => setMergeOpen(false)}
        title={t('merge.dialogTitle')}
        description={t('merge.dialogDescription')}
        footer={
          <>
            <SecondaryButton onClick={() => setMergeOpen(false)}>{t('merge.cancel')}</SecondaryButton>
            <PrimaryButton
              disabled={mergeMutation.isPending || !mergeReason.trim()}
              onClick={() => mergeMutation.mutate()}
            >
              {mergeMutation.isPending ? tCommon('loading') : t('merge.confirm')}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3">
            <p className="text-[12px] font-semibold text-[var(--color-text)]">{t('merge.selectionTitle')}</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{selectedNames.join(' · ')}</p>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[var(--color-text)]">
              {t('merge.reasonLabel')}
            </label>
            <textarea
              className="mt-1.5 h-24 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
            />
          </div>
        </div>
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
