'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { AdminFilterSelect } from '@/components/admin/AdminFilterSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/primitives/input';
import { apiGet } from '@/lib/api/client';
import type { AthleteRow, ClubRow } from '@/types/api';

const PAGE_SIZE = 10;

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

export default function AthletesPage() {
  const t = useTranslations('athletes');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('athleteProfile.identity');
  const locale = useLocale();

  const [search, setSearch] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [page, setPage] = useState(1);

  // Reset to page 1 on filter change
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
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
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
          options={(clubs ?? []).map((c) => ({ value: c.id, label: c.name }))}
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
                      whileHover={{ backgroundColor: 'var(--color-surface-alt)', x: 1 }}
                      transition={{ duration: 0.12 }}
                      className="group bg-[var(--color-surface)]"
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
                            <Link
                              href={`/${locale}/admin/athletes/${athlete.id}`}
                              className="font-semibold text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]"
                            >
                              {athlete.lastName} {athlete.firstName}
                            </Link>
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
                          {athlete.documentId ?? t('badges.missingDocument')}
                        </p>
                      </td>
                      {/* Status badges */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {duplicateCount > 1 && (
                            <StatusChip tone="warning" label={t('badges.duplicateCount', { count: duplicateCount })} />
                          )}
                          {!athlete.clubId && <StatusChip tone="warning" label={t('badges.missingClub')} />}
                          {!athlete.documentId && <StatusChip tone="muted" label={t('badges.missingDocument')} />}
                        </div>
                      </td>
                      {/* Arrow */}
                      <td className="px-5 py-3.5 text-right">
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
                  <Link
                    href={`/${locale}/admin/athletes/${athlete.id}`}
                    className={`${CARD_CLASS} group flex items-start gap-3 p-4 transition-colors hover:bg-[var(--color-surface-alt)]/30`}
                  >
                    <motion.div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)]"
                      whileHover={{ scale: 1.08 }}
                      transition={{ duration: 0.15 }}
                    >
                      {getInitials(athlete)}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{athlete.lastName} {athlete.firstName}</p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{getClubLabel(athlete)} · {getSexLabel(athlete)}</p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{formatDob(athlete.dateOfBirth)}</p>
                      {(duplicateCount > 1 || !athlete.clubId || !athlete.documentId) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {duplicateCount > 1 && <StatusChip tone="warning" label={t('badges.duplicateCount', { count: duplicateCount })} />}
                          {!athlete.clubId && <StatusChip tone="warning" label={t('badges.missingClub')} />}
                          {!athlete.documentId && <StatusChip tone="muted" label={t('badges.missingDocument')} />}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
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
    </div>
  );
}

function getDuplicateCount(athlete: AthleteRow) {
  return athlete.duplicateCount ?? athlete._dedupeCount ?? 0;
}

function getInitials(athlete: AthleteRow) {
  return `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`.toUpperCase();
}

/** Returns page numbers and '…' ellipsis markers for the pagination bar. */
function getPaginationPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
