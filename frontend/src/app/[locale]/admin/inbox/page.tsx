'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { ContactSubmissionRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

export default function InboxPage() {
  const t = useTranslations('inbox');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selected, setSelected] = useState<ContactSubmissionRow | null>(null);

  const { data: submissions, isLoading, error, refetch } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => apiGet<ContactSubmissionRow[]>('/api/forms/submissions'),
  });

  const handleMutation = useMutation({
    mutationFn: (id: string) =>
      apiPost(`/api/forms/submissions/${id}/handled`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      toast(t('markHandled'));
      setSelected(null);
    },
    onError: (error) => {
      toast(getCompactErrorMessage(error, tCommon('error')), 'error');
    },
  });

  function openDetail(sub: ContactSubmissionRow) {
    setSelected(sub);
  }

  function handleMarkHandled(id: string) {
    handleMutation.mutate(id);
  }

  const list = submissions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

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
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.type')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.email')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.created')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {list.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => openDetail(sub)}
                    className="group cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]"
                  >
                    <td className="px-4 py-3 text-[var(--color-text)]">{sub.type}</td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{sub.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{sub.email}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusChip
                          status={sub.status}
                          label={t(`status.${sub.status}` as Parameters<typeof t>[0])}
                          domain="submission"
                        />
                        <span className="translate-x-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] group-hover:opacity-100">→</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            {list.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => openDetail(sub)}
                className="group w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{sub.name}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusChip
                      status={sub.status}
                      label={t(`status.${sub.status}` as Parameters<typeof t>[0])}
                      domain="submission"
                    />
                    <span className="text-[var(--color-text-muted)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]">→</span>
                  </div>
                </div>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {sub.type} · {sub.email} · {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        description={selected ? `${selected.type} · ${new Date(selected.createdAt).toLocaleString()}` : undefined}
        footer={
          selected ? (
            <>
              <SecondaryButton onClick={() => setSelected(null)}>{tCommon('close')}</SecondaryButton>
              {selected.status === 'NEW' && (
                <PrimaryButton
                  disabled={handleMutation.isPending}
                  onClick={() => handleMarkHandled(selected.id)}
                >
                  {handleMutation.isPending ? tCommon('loading') : t('markHandled')}
                </PrimaryButton>
              )}
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{t('columns.email')}</p>
              <p className="text-[13px] text-[var(--color-text)]">{selected.email}</p>
            </div>
            {selected.message && (
              <div>
                <p className="text-[12px] font-medium text-[var(--color-text-muted)]">Message</p>
                <p className="whitespace-pre-wrap text-[13px] text-[var(--color-text)]">{selected.message}</p>
              </div>
            )}
            {selected.clubName && (
              <div>
                <p className="text-[12px] font-medium text-[var(--color-text-muted)]">Club</p>
                <p className="text-[13px] text-[var(--color-text)]">{selected.clubName}</p>
              </div>
            )}
            {selected.notes && (
              <div>
                <p className="text-[12px] font-medium text-[var(--color-text-muted)]">Notes</p>
                <p className="whitespace-pre-wrap text-[13px] text-[var(--color-text)]">{selected.notes}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <StatusChip
                status={selected.status}
                label={t(`status.${selected.status}` as Parameters<typeof t>[0])}
                domain="submission"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
