'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { localizedName } from '@/lib/bilingual';
import type { CountryRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type FormState = { name: string; nameKa: string; code: string };
const EMPTY_FORM: FormState = { name: '', nameKa: '', code: '' };

export default function CountriesPage() {
  const t = useTranslations('countries');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CountryRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: countries, isLoading, error, refetch } = useQuery({
    queryKey: ['countries'],
    queryFn: () => apiGet<CountryRow[]>('/api/countries'),
  });

  const filtered = useMemo(() => {
    if (!countries) return [];
    if (!search.trim()) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameKa?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q),
    );
  }, [countries, search]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<CountryRow>('/api/countries', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast(tCommon('saveSuccess'));
      closeModal();
    },
    onError: (e) => toast(getCompactErrorMessage(e, tCommon('saveFailed')), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/countries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast(tCommon('saveSuccess'));
    },
    onError: (e) => toast(getCompactErrorMessage(e, tCommon('saveFailed')), 'error'),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(country: CountryRow) {
    setEditing(country);
    setForm({ name: country.name, nameKa: country.nameKa ?? '', code: country.code ?? '' });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function goToCountry(id: string) {
    router.push(`/${locale}/admin/countries/${id}`);
  }

  function handleSave() {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      nameKa: form.nameKa.trim() || null,
      code: form.code.trim() || null,
    };
    if (editing) body.id = editing.id;
    saveMutation.mutate(body);
  }

  function handleDelete(country: CountryRow) {
    if (!window.confirm(t('deleteConfirm'))) return;
    deleteMutation.mutate(country.id);
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
        <SkeletonRows rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={<PrimaryButton onClick={openNew}>{t('new')}</PrimaryButton>}
        />
      ) : (
        <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-alt)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.name')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.code')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.regions')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.clubs')}</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map((country) => (
                <tr
                  key={country.id}
                  tabIndex={0}
                  onClick={() => goToCountry(country.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      goToCountry(country.id);
                    }
                  }}
                  className="group cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)] transition-transform duration-200 group-hover:scale-110">
                        {(country.code || localizedName(country.name, country.nameKa, locale)).slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{localizedName(country.name, country.nameKa, locale)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{country.code || '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{t('regionsCount', { count: country.regionCount })}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{t('clubsCount', { count: country.clubCount })}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(country);
                        }}
                        className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {tCommon('edit')}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(country);
                        }}
                        className="text-[12px] font-medium text-[var(--color-danger)] hover:underline"
                      >
                        {tCommon('delete')}
                      </button>
                      <span className="translate-x-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] group-hover:opacity-100">→</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? localizedName(editing.name, editing.nameKa, locale) : t('new')}
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
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('fields.name')}</label>
            <input className={INPUT_CLASS} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('fields.nameKa')}</label>
            <input className={INPUT_CLASS} value={form.nameKa} onChange={(e) => setForm((f) => ({ ...f, nameKa: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('fields.code')}</label>
            <input className={`${INPUT_CLASS} max-w-[140px] uppercase`} maxLength={2} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
