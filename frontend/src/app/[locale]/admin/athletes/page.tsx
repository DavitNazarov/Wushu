'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, Building2, CalendarDays, FileBadge2, Users } from 'lucide-react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { getCompactErrorMessage } from '@/lib/api/error';
import { apiGet, apiPost } from '@/lib/api/client';
import type { AthleteRow, ClubRow } from '@/types/api';

const INPUT_CLASS =
  'h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

const CARD_CLASS =
  'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]';

const ACCENT_PANEL_CLASS =
  'bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_84%,var(--color-surface-alt)_16%))]';

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'warning';
  icon: typeof Users;
  hint: string;
};

function StatCard({ label, value, tone = 'neutral', icon: Icon, hint }: StatCardProps) {
  const accentClass =
    tone === 'warning'
      ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
      : 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</p>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{hint}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
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

  const {
    data: athletes,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['athletes', search, selectedClubId],
    queryFn: () => apiGet<AthleteRow[]>(athleteQueryPath),
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });

  const clubMap = useMemo(
    () => new Map((clubs ?? []).map((club) => [club.id, club])),
    [clubs],
  );

  const rows = athletes ?? [];
  const selectedAthletes = rows.filter((athlete) => selectedIds.includes(athlete.id));
  const selectedNames = selectedAthletes.map((athlete) => `${athlete.lastName} ${athlete.firstName}`);
  const unassignedCount = rows.filter((athlete) => !athlete.clubId).length;
  const linkedClubCount = rows.length - unassignedCount;
  const duplicateReviewCount = rows.filter((athlete) => getDuplicateCount(athlete) > 1).length;
  const canMerge = selectedIds.length === 2;

  const mergeMutation = useMutation({
    mutationFn: () =>
      apiPost<AthleteRow>('/api/athletes/merge', {
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
    onError: (mutationError) =>
      toast(getCompactErrorMessage(mutationError, t('merge.errorGeneric')), 'error'),
  });

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(-2),
    );
  }

  function openMerge() {
    if (!canMerge) return;
    setMergeReason('');
    setMergeOpen(true);
  }

  function formatDob(value: string | null | undefined) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale);
    } catch {
      return '—';
    }
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
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <PrimaryButton disabled={!canMerge} onClick={openMerge}>
            {t('merge.button')}
          </PrimaryButton>
        }
      />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className={`${CARD_CLASS} overflow-hidden`}>
          <div className={`border-b border-[var(--color-border)]/80 px-5 py-5 ${ACCENT_PANEL_CLASS}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
              {t('overview.eyebrow')}
            </p>
            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
                  {t('overview.title')}
                </h2>
                <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-muted)]">
                  {t('overview.description')}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-4 py-3 text-[12px] text-[var(--color-text-muted)]">
                <span className="font-medium text-[var(--color-text)]">{rows.length}</span>{' '}
                {t('overview.loadedCount')}
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t('stats.total')}
              value={rows.length}
              icon={Users}
              hint={t('stats.totalHint')}
            />
            <StatCard
              label={t('stats.linked')}
              value={linkedClubCount}
              icon={Building2}
              hint={t('stats.linkedHint')}
            />
            <StatCard
              label={t('stats.needsClub')}
              value={unassignedCount}
              icon={AlertTriangle}
              tone={unassignedCount > 0 ? 'warning' : 'neutral'}
              hint={t('stats.needsClubHint')}
            />
            <StatCard
              label={t('stats.duplicates')}
              value={duplicateReviewCount}
              icon={ArrowRightLeft}
              tone={duplicateReviewCount > 0 ? 'warning' : 'neutral'}
              hint={t('stats.duplicatesHint')}
            />
          </div>
        </section>

        <aside className={`${CARD_CLASS} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                {t('selection.eyebrow')}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--color-text)]">{t('selection.title')}</h2>
            </div>
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-primary)]">
              {selectedIds.length}/2
            </span>
          </div>

          <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-muted)]">{t('selection.description')}</p>

          <div className="mt-4 space-y-2">
            {selectedNames.length > 0 ? (
              selectedNames.map((name, index) => (
                <div
                  key={`${name}-${index}`}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    {t('selection.slotLabel', { index: index + 1 })}
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-[var(--color-text)]">{name}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-3 py-4 text-[13px] text-[var(--color-text-muted)]">
                {t('selection.empty')}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <PrimaryButton disabled={!canMerge} onClick={openMerge}>
              {t('merge.button')}
            </PrimaryButton>
            <SecondaryButton
              disabled={selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
            >
              {t('selection.clear')}
            </SecondaryButton>
          </div>
        </aside>
      </div>

      <section className={`${CARD_CLASS} p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              {t('filters.eyebrow')}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--color-text)]">{t('filters.title')}</h2>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{t('dedupeHint')}</p>
          </div>

          <div className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-[minmax(0,1fr)_220px]">
            <input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={INPUT_CLASS}
            />
            <select
              value={selectedClubId}
              onChange={(event) => setSelectedClubId(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">{t('filters.allClubs')}</option>
              {(clubs ?? []).map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {isLoading ? (
        <SkeletonRows rows={6} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className={`${CARD_CLASS} hidden overflow-hidden lg:block`}>
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)] text-left">
                  <th className="w-14 px-4 py-3 font-medium text-[var(--color-text-muted)]">{t('columns.select')}</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{t('columns.club')}</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{t('columns.identity')}</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{t('columns.status')}</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((athlete) => {
                  const selected = selectedIds.includes(athlete.id);
                  const duplicateCount = getDuplicateCount(athlete);
                  const missingClub = !athlete.clubId;
                  const missingDocument = !athlete.documentId;

                  return (
                    <tr
                      key={athlete.id}
                      onClick={() => toggleSelected(athlete.id)}
                      className={`cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] ${
                        selected ? 'ring-1 ring-inset ring-[var(--color-primary)]/35' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelected(athlete.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
                            {getInitials(athlete)}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/${locale}/admin/athletes/${athlete.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="block truncate text-[14px] font-semibold text-[var(--color-text)] hover:underline"
                            >
                              {athlete.lastName} {athlete.firstName}
                            </Link>
                            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{getSexLabel(athlete)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                          <div>
                            <p className="font-medium text-[var(--color-text)]">{getClubLabel(athlete)}</p>
                            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{getClubMeta(athlete) ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
                            <CalendarDays className="h-4 w-4" />
                            <span>{formatDob(athlete.dateOfBirth)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
                            <FileBadge2 className="h-4 w-4" />
                            <span>{athlete.documentId ?? t('badges.missingDocument')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusChip
                            tone={duplicateCount > 1 ? 'warning' : 'neutral'}
                            label={
                              duplicateCount > 1
                                ? t('badges.duplicateCount', { count: duplicateCount })
                                : t('badges.noDuplicates')
                            }
                          />
                          {missingClub ? (
                            <StatusChip tone="warning" label={t('badges.missingClub')} />
                          ) : null}
                          {missingDocument ? (
                            <StatusChip tone="muted" label={t('badges.missingDocument')} />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/${locale}/admin/athletes/${athlete.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {t('actions.viewProfile')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {rows.map((athlete) => {
              const selected = selectedIds.includes(athlete.id);
              const duplicateCount = getDuplicateCount(athlete);
              const missingClub = !athlete.clubId;
              const missingDocument = !athlete.documentId;

              return (
                <button
                  key={athlete.id}
                  type="button"
                  onClick={() => toggleSelected(athlete.id)}
                  className={`${CARD_CLASS} w-full p-4 text-left transition ${
                    selected ? 'border-[var(--color-primary)]/45 ring-1 ring-[var(--color-primary)]/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(athlete.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/${locale}/admin/athletes/${athlete.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="text-[14px] font-semibold text-[var(--color-text)] hover:underline"
                          >
                            {athlete.lastName} {athlete.firstName}
                          </Link>
                          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{getSexLabel(athlete)}</p>
                        </div>
                        <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)]">
                          {getInitials(athlete)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-[12px] text-[var(--color-text-muted)]">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{getClubLabel(athlete)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>{formatDob(athlete.dateOfBirth)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileBadge2 className="h-4 w-4" />
                          <span>{athlete.documentId ?? t('badges.missingDocument')}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusChip
                          tone={duplicateCount > 1 ? 'warning' : 'neutral'}
                          label={
                            duplicateCount > 1
                              ? t('badges.duplicateCount', { count: duplicateCount })
                              : t('badges.noDuplicates')
                          }
                        />
                        {missingClub ? <StatusChip tone="warning" label={t('badges.missingClub')} /> : null}
                        {missingDocument ? (
                          <StatusChip tone="muted" label={t('badges.missingDocument')} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

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
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3">
            <p className="text-[12px] font-medium text-[var(--color-text)]">{t('merge.selectionTitle')}</p>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{selectedNames.join('  /  ')}</p>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text)]">
              {t('merge.reasonLabel')}
            </label>
            <textarea
              className="mt-1 h-24 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
              value={mergeReason}
              onChange={(event) => setMergeReason(event.target.value)}
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

type StatusChipProps = {
  label: string;
  tone: 'neutral' | 'warning' | 'muted';
};

function StatusChip({ label, tone }: StatusChipProps) {
  const toneClass =
    tone === 'warning'
      ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
      : tone === 'muted'
        ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
        : 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]';

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>{label}</span>;
}
