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
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { localizedName } from '@/lib/bilingual';
import type { ClubRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type FormState = { name: string; nameKa: string; city: string; country: string };
const EMPTY_FORM: FormState = { name: '', nameKa: '', city: '', country: '' };

function isGeorgianCountry(country: string): boolean {
  const c = country.trim().toLowerCase();
  return c === 'ge' || c === 'georgia';
}

export default function ClubsPage() {
  const t = useTranslations('clubs');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
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
      queryClient.invalidateQueries({ queryKey: ['club-details'] });
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
    setForm({ name: club.name, nameKa: club.nameKa ?? '', city: club.city ?? '', country: club.country ?? '' });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingClub(null);
    setForm(EMPTY_FORM);
  }

  function goToClubDetails(clubId: string) {
    router.push(`/${locale}/admin/clubs/${clubId}`);
  }

  function handleSave() {
    const { nameKa, ...rest } = form;
    const body: Record<string, unknown> = { ...rest };
    if (isGeorgianCountry(form.country)) body.nameKa = nameKa.trim() || null;
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
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{club.city || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{club.country || '—'}</td>
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
                        {[club.city, club.country].filter(Boolean).join(', ') || '—'}
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
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
              {t('fields.country')}
            </label>
            <input
              className={INPUT_CLASS}
              value={form.country}
              onChange={(e) => {
                const next = e.target.value;
                setForm((f) => ({
                  ...f,
                  country: next,
                  nameKa: isGeorgianCountry(next) ? f.nameKa : '',
                }));
              }}
            />
          </div>
          {isGeorgianCountry(form.country) && (
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
                {t('fields.nameKa')}
              </label>
              <input
                className={INPUT_CLASS}
                value={form.nameKa}
                onChange={(e) => setForm((f) => ({ ...f, nameKa: e.target.value }))}
              />
            </div>
          )}
          {renderField('city')}
        </div>
      </Modal>
    </div>
  );
}
