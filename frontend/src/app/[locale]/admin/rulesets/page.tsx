'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import type { RulesetRow } from '@/types/api';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export default function RulesetsPage() {
  const t = useTranslations('admin.rulesets');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');

  const { data: rulesets, isLoading, error, refetch } = useQuery({
    queryKey: ['rulesets'],
    queryFn: () => apiGet<RulesetRow[]>('/api/rulesets'),
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost<RulesetRow>('/api/rulesets', { name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rulesets'] });
      toast(tCommon('saveSuccess'));
      setCreateOpen(false);
      setName('');
    },
    onError: () => toast(tCommon('saveFailed'), 'error'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiPost<RulesetRow>(`/api/rulesets/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rulesets'] });
      toast(tCommon('saveSuccess'));
    },
    onError: () => toast(tCommon('saveFailed'), 'error'),
  });

  function openCreate() {
    setName('');
    setCreateOpen(true);
  }

  function statusLabel(status: string) {
    return t(`status.${status.toLowerCase() as 'draft' | 'active'}`);
  }

  const list = rulesets ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={<PrimaryButton onClick={openCreate}>{t('new')}</PrimaryButton>}
      />

      {error && (
        <InlineAlert
          variant="error"
          actions={
            <button onClick={() => refetch()} className="text-[13px] font-medium underline">
              {tCommon('retry')}
            </button>
          }
        >
          {tCommon('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <SkeletonRows rows={4} cols={4} />
      ) : list.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={<PrimaryButton onClick={openCreate}>{t('new')}</PrimaryButton>}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.version')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {list.map((rs) => (
                  <tr key={rs.id} className="bg-[var(--color-surface)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{rs.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">v{rs.version}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={rs.status} label={statusLabel(rs.status)} domain="ruleset" />
                    </td>
                    <td className="px-4 py-3">
                      {rs.status === 'DRAFT' && (
                        <SecondaryButton
                          className="h-8 px-3 text-[12px]"
                          disabled={activateMutation.isPending}
                          onClick={() => activateMutation.mutate(rs.id)}
                        >
                          {t('status.active')}
                        </SecondaryButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            {list.map((rs) => (
              <div
                key={rs.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-[var(--color-text)]">{rs.name}</p>
                  <StatusChip status={rs.status} label={statusLabel(rs.status)} domain="ruleset" />
                </div>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">v{rs.version}</p>
                {rs.status === 'DRAFT' && (
                  <div className="mt-3">
                    <SecondaryButton
                      className="h-8 px-3 text-[12px]"
                      disabled={activateMutation.isPending}
                      onClick={() => activateMutation.mutate(rs.id)}
                    >
                      {t('status.active')}
                    </SecondaryButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('new')}
        footer={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </SecondaryButton>
            <PrimaryButton
              disabled={createMutation.isPending || !name.trim()}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? tCommon('loading') : tCommon('create')}
            </PrimaryButton>
          </>
        }
      >
        <div>
          <label className="block text-[13px] font-medium text-[var(--color-text)]">
            {t('columns.name')}
          </label>
          <input
            className={`${INPUT_CLASS} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
