'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { AthleteRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export default function AthletesPage() {
  const t = useTranslations('athletes');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeReason, setMergeReason] = useState('');

  const queryPath = search.trim()
    ? `/api/athletes?search=${encodeURIComponent(search.trim())}`
    : '/api/athletes';

  const { data: athletes, isLoading, error, refetch } = useQuery({
    queryKey: ['athletes', search],
    queryFn: () => apiGet<AthleteRow[]>(queryPath),
  });

  const canMerge = selectedIds.length === 2;

  function toggleSelected(id: string) {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-2),
    );
  }

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
    onError: (error) =>
      toast(getCompactErrorMessage(error, t('merge.errorGeneric')), 'error'),
  });

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
    } catch {
      return '—';
    }
  }

  const list = athletes ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-[var(--color-text-muted)]">{t('dedupeHint')}</p>
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT_CLASS} sm:max-w-xs`}
        />
      </div>

      {isLoading ? (
        <SkeletonRows rows={5} cols={5} />
      ) : list.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.dob')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.club')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.document')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.dedupe')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {list.map((a) => {
                  const selected = selectedIds.includes(a.id);
                  const dupeCount = a._dedupeCount ?? 0;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => toggleSelected(a.id)}
                      className={`cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] ${
                        selected ? 'ring-1 ring-inset ring-[var(--color-primary)]/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(a.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="font-medium text-[var(--color-text)]">
                            {a.lastName} {a.firstName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDob(a.dateOfBirth)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{a.club?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{a.documentId ?? '—'}</td>
                      <td className="px-4 py-3">
                        {dupeCount > 1 ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--color-warning)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-warning)]">
                            {dupeCount}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-text-muted)]">{dupeCount}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            {list.map((a) => {
              const selected = selectedIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleSelected(a.id)}
                  className={`w-full rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-4 text-left transition ${
                    selected
                      ? 'border-[var(--color-primary)]/40 ring-1 ring-[var(--color-primary)]/20'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                    />
                    <p className="text-[13px] font-medium text-[var(--color-text)]">
                      {a.lastName} {a.firstName}
                    </p>
                  </div>
                  <p className="mt-1 pl-6 text-[12px] text-[var(--color-text-muted)]">
                    {formatDob(a.dateOfBirth)} · {a.club?.name ?? '—'} · {a.documentId ?? '—'}
                  </p>
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
            <SecondaryButton onClick={() => setMergeOpen(false)}>
              {t('merge.cancel')}
            </SecondaryButton>
            <PrimaryButton
              disabled={mergeMutation.isPending || !mergeReason.trim()}
              onClick={() => mergeMutation.mutate()}
            >
              {mergeMutation.isPending ? tCommon('loading') : t('merge.confirm')}
            </PrimaryButton>
          </>
        }
      >
        <div>
          <label className="block text-[13px] font-medium text-[var(--color-text)]">
            {t('merge.reasonLabel')}
          </label>
          <textarea
            className="mt-1 h-20 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
            value={mergeReason}
            onChange={(e) => setMergeReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
