'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
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
import { localizedName } from '@/lib/bilingual';
import type { ClubRow, CountryRow, RegionRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const SELECT_CLASS = `${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-60`;

type FormState = { name: string; nameKa: string; city: string; countryId: string; regionId: string };
const EMPTY_FORM: FormState = { name: '', nameKa: '', city: '', countryId: '', regionId: '' };

export default function ClubsPage() {
  const t = useTranslations('clubs');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filterCountryId, setFilterCountryId] = useState('');
  const [filterRegionId, setFilterRegionId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: clubs, isLoading, error, refetch } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
  });
  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: () => apiGet<CountryRow[]>('/api/countries'),
  });
  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => apiGet<RegionRow[]>('/api/regions'),
  });

  // Region options for the form's cascading select (filtered to the chosen country).
  const formRegions = useMemo(
    () => (regions ?? []).filter((r) => r.countryId === form.countryId),
    [regions, form.countryId],
  );
  const selectedCountry = countries?.find((c) => c.id === form.countryId) ?? null;
  const isGeorgianCountry = selectedCountry?.code === 'GE';

  const filtered = useMemo(() => {
    if (!clubs) return [];
    const q = search.trim().toLowerCase();
    return clubs.filter((c) => {
      if (filterCountryId && c.countryId !== filterCountryId) return false;
      if (filterRegionId && c.regionId !== filterRegionId) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.regionName?.toLowerCase().includes(q)
      );
    });
  }, [clubs, search, filterCountryId, filterRegionId]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost<ClubRow>('/api/clubs', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club-details'] });
      queryClient.invalidateQueries({ queryKey: ['countries'] });
      queryClient.invalidateQueries({ queryKey: ['country'] });
      toast(tCommon('saveSuccess'));
      closeModal();
    },
    onError: (error) => toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error'),
  });

  function openNew(preset?: { countryId?: string; regionId?: string }) {
    setEditingClub(null);
    setForm({ ...EMPTY_FORM, countryId: preset?.countryId ?? '', regionId: preset?.regionId ?? '' });
    setModalOpen(true);
  }

  function openEdit(club: ClubRow) {
    setEditingClub(club);
    setForm({
      name: club.name,
      nameKa: club.nameKa ?? '',
      city: club.city ?? '',
      countryId: club.countryId ?? '',
      regionId: club.regionId ?? '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingClub(null);
    setForm(EMPTY_FORM);
  }

  // Deep-link from a region page: /admin/clubs?countryId=…&regionId=… opens the
  // create modal with that region preselected.
  useEffect(() => {
    const countryId = searchParams.get('countryId');
    const regionId = searchParams.get('regionId');
    if (countryId || regionId) {
      openNew({ countryId: countryId ?? '', regionId: regionId ?? '' });
      router.replace(`/${locale}/admin/clubs`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToClubDetails(clubId: string) {
    router.push(`/${locale}/admin/clubs/${clubId}`);
  }

  function handleSave() {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      city: form.city.trim() || null,
      regionId: form.regionId,
      nameKa: isGeorgianCountry ? form.nameKa.trim() || null : null,
    };
    if (editingClub) body.id = editingClub.id;
    saveMutation.mutate(body);
  }

  const canSave = Boolean(form.name.trim() && form.regionId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={<PrimaryButton onClick={() => openNew()}>{t('new')}</PrimaryButton>}
      />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={tCommon('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT_CLASS} max-w-xs`}
        />
        <select
          value={filterCountryId}
          onChange={(e) => {
            setFilterCountryId(e.target.value);
            setFilterRegionId('');
          }}
          className={`${SELECT_CLASS} max-w-[180px]`}
        >
          <option value="">{t('columns.country')}</option>
          {countries?.map((c) => (
            <option key={c.id} value={c.id}>{localizedName(c.name, c.nameKa, locale)}</option>
          ))}
        </select>
        <select
          value={filterRegionId}
          onChange={(e) => setFilterRegionId(e.target.value)}
          className={`${SELECT_CLASS} max-w-[180px]`}
        >
          <option value="">{t('columns.region')}</option>
          {(regions ?? [])
            .filter((r) => !filterCountryId || r.countryId === filterCountryId)
            .map((r) => (
              <option key={r.id} value={r.id}>{localizedName(r.name, r.nameKa, locale)}</option>
            ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonRows rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={<PrimaryButton onClick={() => openNew()}>{t('new')}</PrimaryButton>}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.name')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.country')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.region')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.city')}</th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--color-text-muted)]">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((club) => (
                  <tr
                    key={club.id}
                    tabIndex={0}
                    onClick={() => goToClubDetails(club.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        goToClubDetails(club.id);
                      }
                    }}
                    className="group cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)] transition-transform duration-200 group-hover:scale-110">
                          {localizedName(club.name, club.nameKa, locale).slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{localizedName(club.name, club.nameKa, locale)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{club.country || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{club.regionName ? localizedName(club.regionName, club.regionNameKa, locale) : '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{club.city || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(club);
                          }}
                          className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {tCommon('edit')}
                        </button>
                        <span className="translate-x-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] group-hover:opacity-100">→</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            {filtered.map((club) => (
              <div
                key={club.id}
                role="button"
                tabIndex={0}
                onClick={() => goToClubDetails(club.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    goToClubDetails(club.id);
                  }
                }}
                className="group w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[12px] font-bold uppercase text-[var(--color-primary)]">
                      {localizedName(club.name, club.nameKa, locale).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{localizedName(club.name, club.nameKa, locale)}</p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">
                        {[club.country, club.regionName ? localizedName(club.regionName, club.regionNameKa, locale) : null, club.city].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(club);
                      }}
                      className="shrink-0 text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {tCommon('edit')}
                    </button>
                    <span className="text-[var(--color-text-muted)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingClub ? localizedName(editingClub.name, editingClub.nameKa, locale) : t('new')}
        footer={
          <>
            <SecondaryButton onClick={closeModal}>{tCommon('cancel')}</SecondaryButton>
            <PrimaryButton disabled={saveMutation.isPending || !canSave} onClick={handleSave}>
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
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('fields.country')}</label>
            <select
              className={SELECT_CLASS}
              value={form.countryId}
              onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value, regionId: '' }))}
            >
              <option value="">{t('fields.selectCountry')}</option>
              {countries?.map((c) => (
                <option key={c.id} value={c.id}>{localizedName(c.name, c.nameKa, locale)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('fields.region')}</label>
            <select
              className={SELECT_CLASS}
              value={form.regionId}
              disabled={!form.countryId}
              onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
            >
              <option value="">
                {!form.countryId
                  ? t('fields.selectCountryFirst')
                  : formRegions.length === 0
                    ? t('fields.noRegions')
                    : t('fields.selectRegion')}
              </option>
              {formRegions.map((r) => (
                <option key={r.id} value={r.id}>{localizedName(r.name, r.nameKa, locale)}</option>
              ))}
            </select>
          </div>

          {isGeorgianCountry && (
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('fields.nameKa')}</label>
              <input className={INPUT_CLASS} value={form.nameKa} onChange={(e) => setForm((f) => ({ ...f, nameKa: e.target.value }))} />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">{t('fields.city')}</label>
            <input className={INPUT_CLASS} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
