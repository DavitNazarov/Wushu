'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
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
import type { ClubRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type FormState = { name: string; city: string; country: string };
const EMPTY_FORM: FormState = { name: '', city: '', country: '' };

export default function ClubsPage() {
  const t = useTranslations('clubs');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: clubs, isLoading, error, refetch } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });

  const filtered = useMemo(() => {
    if (!clubs) return [];
    if (!search.trim()) return clubs;
    const q = search.toLowerCase();
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q),
    );
  }, [clubs, search]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<ClubRow>('/api/clubs', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast(tCommon('saveSuccess'));
      closeModal();
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error'),
  });

  function openNew() {
    setEditingClub(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(club: ClubRow) {
    setEditingClub(club);
    setForm({ name: club.name, city: club.city ?? '', country: club.country ?? '' });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingClub(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    const body: Record<string, unknown> = { ...form };
    if (editingClub) body.id = editingClub.id;
    saveMutation.mutate(body);
  }

  function renderField(key: keyof FormState) {
    return (
      <div>
        <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
          {t(`fields.${key}`)}
        </label>
        <input
          className={INPUT_CLASS}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={<PrimaryButton onClick={openNew}>{t('new')}</PrimaryButton>}
      />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      <input
        type="text"
        placeholder={tCommon('search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${INPUT_CLASS} max-w-xs`}
      />

      {isLoading ? (
        <SkeletonRows rows={5} cols={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={<PrimaryButton onClick={openNew}>{t('new')}</PrimaryButton>}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.city')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.country')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((club) => (
                  <tr
                    key={club.id}
                    onClick={() => openEdit(club)}
                    className="cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{club.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{club.city || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{club.country || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            {filtered.map((club) => (
              <button
                key={club.id}
                type="button"
                onClick={() => openEdit(club)}
                className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:bg-[var(--color-surface-alt)]"
              >
                <p className="text-[13px] font-medium text-[var(--color-text)]">{club.name}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {[club.city, club.country].filter(Boolean).join(', ') || '—'}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingClub ? editingClub.name : t('new')}
        footer={
          <>
            <SecondaryButton onClick={closeModal}>{tCommon('cancel')}</SecondaryButton>
            <PrimaryButton
              disabled={saveMutation.isPending || !form.name.trim()}
              onClick={handleSave}
            >
              {saveMutation.isPending ? tCommon('loading') : tCommon('save')}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {renderField('name')}
          {renderField('city')}
          {renderField('country')}
        </div>
      </Modal>
    </div>
  );
}
