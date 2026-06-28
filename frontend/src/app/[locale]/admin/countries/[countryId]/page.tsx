'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
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
import type { CountryDetail, CountryRegionRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type FormState = { name: string; nameKa: string };
const EMPTY_FORM: FormState = { name: '', nameKa: '' };

export default function CountryDetailPage() {
  const t = useTranslations('countries');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { countryId } = useParams<{ countryId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CountryRegionRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: country, isLoading, error, refetch } = useQuery({
    queryKey: ['country', countryId],
    queryFn: () => apiGet<CountryDetail>(`/api/countries/${countryId}`),
  });

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/api/cities', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['country', countryId] });
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      toast(tCommon('saveSuccess'));
      closeModal();
    },
    onError: (e) => toast(getCompactErrorMessage(e, tCommon('saveFailed')), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/cities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['country', countryId] });
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

  function openEdit(city: CountryRegionRow) {
    setEditing(city);
    setForm({ name: city.name, nameKa: city.nameKa ?? '' });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    const body: Record<string, unknown> = {
      countryId,
      name: form.name.trim(),
      nameKa: form.nameKa.trim() || null,
    };
    if (editing) body.id = editing.id;
    saveMutation.mutate(body);
  }

  function handleDelete(city: CountryRegionRow) {
    if (!window.confirm(t('deleteRegionConfirm'))) return;
    deleteMutation.mutate(city.id);
  }

  function goToRegion(cityId: string) {
    router.push(`/${locale}/admin/countries/${countryId}/cities/${cityId}`);
  }

  const countryLabel = country
    ? localizedName(country.name, country.nameKa, locale)
    : '';

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
        <Link href={`/${locale}/admin/countries`} className="hover:text-[var(--color-primary)] hover:underline">
          {t('backToCountries')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--color-text)]">{countryLabel || '…'}</span>
      </nav>

      <PageHeader
        title={countryLabel || t('regionsTitle')}
        actions={<PrimaryButton onClick={openNew}>{t('newRegion')}</PrimaryButton>}
      />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <SkeletonRows rows={4} cols={2} />
      ) : !country || country.cities.length === 0 ? (
        <EmptyState
          title={t('emptyRegionsTitle')}
          description={t('emptyRegionsDescription')}
          action={<PrimaryButton onClick={openNew}>{t('newRegion')}</PrimaryButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-alt)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('regionColumns.name')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('regionColumns.clubs')}</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {country.cities.map((city) => (
                <tr
                  key={city.id}
                  tabIndex={0}
                  onClick={() => goToRegion(city.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      goToRegion(city.id);
                    }
                  }}
                  className="group cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{localizedName(city.name, city.nameKa, locale)}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{t('clubsCount', { count: city.clubCount })}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(city);
                        }}
                        className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {tCommon('edit')}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(city);
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
        title={editing ? localizedName(editing.name, editing.nameKa, locale) : t('newRegion')}
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
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('regionFields.name')}</label>
            <input className={INPUT_CLASS} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('regionFields.nameKa')}</label>
            <input className={INPUT_CLASS} value={form.nameKa} onChange={(e) => setForm((f) => ({ ...f, nameKa: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
