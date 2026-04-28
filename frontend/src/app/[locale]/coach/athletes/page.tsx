'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileBadge2,
  Search,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { localizedFullName } from '@/lib/bilingual';
import { useCurrentUser, useIsGeorgian } from '@/hooks/useCurrentUser';
import type { AthleteRow } from '@/types/api';

const EMPTY_SEX = '__none__';
const PAGE_SIZE = 10;

function AthleteAvatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-10 w-10 text-[12px]',
    lg: 'h-14 w-14 text-[15px]',
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] font-semibold uppercase text-[var(--color-primary)] ${sizeClasses[size]}`}
    >
      {initials}
    </div>
  );
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function CoachAthletesPage() {
  const t = useTranslations('coach.athletes');
  const tC = useTranslations('common');
  const tAth = useTranslations('athletes');
  const tProfile = useTranslations('athleteProfile.identity');
  const locale = useLocale();
  const { toast } = useToast();

  const { data: currentUser } = useCurrentUser();
  const isGeorgian = useIsGeorgian(currentUser?.nationality);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);

  // Edit modal state
  const [editAthlete, setEditAthlete] = useState<AthleteRow | null>(null);

  // Shared form fields (used by both add and edit)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameKa, setFirstNameKa] = useState('');
  const [lastNameKa, setLastNameKa] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [docIdError, setDocIdError] = useState<string | null>(null);
  const [sex, setSex] = useState<'MALE' | 'FEMALE' | ''>('');

  const queryPath = search.trim()
    ? `/api/athletes?search=${encodeURIComponent(search.trim())}`
    : '/api/athletes';

  const { data: athletes, isLoading, error, refetch } = useQuery({
    queryKey: ['athletes', search],
    queryFn: () => apiGet<AthleteRow[]>(queryPath),
  });

  const saveMut = useMutation({
    mutationFn: (body: {
      id?: string;
      firstName: string;
      firstNameKa?: string | null;
      lastName: string;
      lastNameKa?: string | null;
      dateOfBirth: string;
      documentId: string;
      sex?: 'MALE' | 'FEMALE';
    }) => apiPost<{ athlete: AthleteRow }>('/api/athletes', body),
    onSuccess: () => {
      refetch();
      closeModals();
      toast(tC('saveSuccess'));
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.code === 'DOCUMENT_ID_ALREADY_EXISTS') {
        setDocIdError(t('errors.documentIdExists'));
        return;
      }
      toast(e instanceof Error ? e.message : tC('error'), 'error');
    },
  });

  function closeModals() {
    setAddOpen(false);
    setEditAthlete(null);
    setFirstName('');
    setLastName('');
    setFirstNameKa('');
    setLastNameKa('');
    setDateOfBirth('');
    setDocumentId('');
    setDocIdError(null);
    setSex('');
  }

  function openAdd() {
    closeModals();
    setAddOpen(true);
  }

  function openEdit(a: AthleteRow) {
    setFirstName(a.firstName);
    setLastName(a.lastName);
    setFirstNameKa(a.firstNameKa ?? '');
    setLastNameKa(a.lastNameKa ?? '');
    setDateOfBirth(toDateInput(a.dateOfBirth));
    setDocumentId(a.documentId ?? '');
    setDocIdError(null);
    setSex(a.sex ?? '');
    setEditAthlete(a);
  }

  function handleSave(editingId?: string) {
    setDocIdError(null);
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      toast('Date must be YYYY-MM-DD', 'error');
      return;
    }
    if (!documentId.trim()) {
      setDocIdError(isGeorgian ? t('errors.nationalIdRequired') : t('errors.passportRequired'));
      return;
    }
    if (isGeorgian && !/^\d{11}$/.test(documentId.trim())) {
      setDocIdError(t('errors.nationalIdFormat'));
      return;
    }

    saveMut.mutate({
      id: editingId,
      firstName: firstName.trim(),
      firstNameKa: isGeorgian ? firstNameKa.trim() || null : null,
      lastName: lastName.trim(),
      lastNameKa: isGeorgian ? lastNameKa.trim() || null : null,
      dateOfBirth,
      documentId: documentId.trim(),
      sex: sex || undefined,
    });
  }

  function formatDob(value: string | null | undefined) {
    if (!value) return '—';
    try { return new Date(value).toLocaleDateString(locale); } catch { return '—'; }
  }

  function getInitials(a: AthleteRow) {
    return `${a.firstName.charAt(0)}${a.lastName.charAt(0)}`.toUpperCase();
  }

  const allRows = athletes ?? [];

  // Reset page when search changes
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = allRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Form validity
  const hasKaNames = !isGeorgian || (!!firstNameKa.trim() && !!lastNameKa.trim());
  const hasValidDocId =
    !!documentId.trim() &&
    (!isGeorgian || /^\d{11}$/.test(documentId.trim()));
  const formValid =
    !!firstName.trim() && !!lastName.trim() && !!dateOfBirth && hasKaNames && hasValidDocId;

  // Athlete form fields (shared between add + edit modals)
  const athleteForm = (
    <div className="space-y-4">
      {/* English name row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{isGeorgian ? t('fields.firstNameEn') : t('fields.firstName')} *</Label>
          <Input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{isGeorgian ? t('fields.lastNameEn') : t('fields.lastName')} *</Label>
          <Input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
      </div>

      {/* Georgian name row — only for Georgian coaches */}
      {isGeorgian && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t('fields.firstNameKa')} *</Label>
            <Input
              type="text"
              value={firstNameKa}
              onChange={(e) => setFirstNameKa(e.target.value)}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.lastNameKa')} *</Label>
            <Input
              type="text"
              value={lastNameKa}
              onChange={(e) => setLastNameKa(e.target.value)}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('fields.dateOfBirth')} *</Label>
          <Input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="h-10 bg-[var(--color-surface)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('fields.sex')}</Label>
          <Select
            value={sex || EMPTY_SEX}
            onValueChange={(v) => setSex(v === EMPTY_SEX ? '' : (v as 'MALE' | 'FEMALE'))}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SEX}>—</SelectItem>
              <SelectItem value="MALE">{t('fields.sexOptions.male')}</SelectItem>
              <SelectItem value="FEMALE">{t('fields.sexOptions.female')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>
          {isGeorgian ? t('fields.nationalId') : t('fields.passportNumber')} *
        </Label>
        <Input
          type="text"
          inputMode={isGeorgian ? 'numeric' : undefined}
          maxLength={isGeorgian ? 11 : undefined}
          value={documentId}
          onChange={(e) => {
            const val = isGeorgian
              ? e.target.value.replace(/\D/g, '').slice(0, 11)
              : e.target.value;
            setDocumentId(val);
            setDocIdError(null);
          }}
          className="h-10 bg-[var(--color-surface)]"
          placeholder={isGeorgian ? '00000000000' : ''}
        />
        {isGeorgian && (
          <p className="text-[12px] text-[var(--color-text-muted)]">
            {t('fields.nationalIdHint')}
          </p>
        )}
        {docIdError && (
          <p className="text-[12px] text-[var(--color-danger)]">{docIdError}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <Input
                type="search"
                placeholder={tAth('searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-10 w-48 pl-9 bg-[var(--color-surface)]"
              />
            </div>
            <SecondaryButton onClick={openAdd}>{t('addAthlete')}</SecondaryButton>
          </div>
        }
      />

      {error && (
        <InlineAlert
          variant="error"
          actions={
            <button onClick={() => refetch()} className="text-[13px] font-medium underline">
              {tC('retry')}
            </button>
          }
        >
          {tC('loadError')}
        </InlineAlert>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : allRows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-[var(--color-surface-alt)]">
                <tr>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tAth('columns.name')}</th>
                  <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tAth('columns.dob')}</th>
                  <th className="hidden px-4 py-3 font-medium text-[var(--color-text-muted)] md:table-cell">{tAth('columns.document')}</th>
                  <th className="hidden px-4 py-3 font-medium text-[var(--color-text-muted)] lg:table-cell">{tAth('columns.sex')}</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => openEdit(a)}
                    className="cursor-pointer border-t border-[var(--color-border)] bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AthleteAvatar initials={getInitials(a)} size="sm" />
                        <span className="font-medium text-[var(--color-text)]">
                          {localizedFullName(a.firstName, a.lastName, a.firstNameKa, a.lastNameKa, locale)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDob(a.dateOfBirth)}</td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-muted)] md:table-cell">{a.documentId || '—'}</td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-muted)] lg:table-cell">
                      {a.sex ? tProfile(`sexValue.${a.sex}`) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${locale}/coach/athletes/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                        aria-label={t('viewProfile')}
                      >
                        {t('viewProfile')} <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {rows.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openEdit(a)}
                className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)]/40"
              >
                <div className="flex items-center gap-3">
                  <AthleteAvatar initials={getInitials(a)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                      {localizedFullName(a.firstName, a.lastName, a.firstNameKa, a.lastNameKa, locale)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {formatDob(a.dateOfBirth)}{a.sex ? ` · ${tProfile(`sexValue.${a.sex}`)}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 min-w-[32px] rounded-[var(--radius-input)] border px-2.5 text-[13px] font-medium transition ${
                    p === safePage
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit athlete modal */}
      <Modal
        open={!!editAthlete}
        onClose={closeModals}
        title={editAthlete ? localizedFullName(editAthlete.firstName, editAthlete.lastName, editAthlete.firstNameKa, editAthlete.lastNameKa, locale) : ''}
      >
        <div className="space-y-5">
          {/* Athlete info header */}
          {editAthlete && (
            <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-primary)] text-[15px] font-semibold uppercase tracking-[0.08em] text-white">
                {getInitials(editAthlete)}
              </div>
              <div className="min-w-0 flex-1 text-[12px] text-[var(--color-text-muted)]">
                <div className="flex flex-wrap gap-3">
                  {editAthlete.dateOfBirth && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDob(editAthlete.dateOfBirth)}
                    </span>
                  )}
                  {editAthlete.sex && (
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      {tProfile(`sexValue.${editAthlete.sex}`)}
                    </span>
                  )}
                  {editAthlete.documentId && (
                    <span className="flex items-center gap-1">
                      <FileBadge2 className="h-3.5 w-3.5" />
                      {editAthlete.documentId}
                    </span>
                  )}
                  {editAthlete.club && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {editAthlete.club.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {athleteForm}

          <div className="flex items-center justify-between gap-2 pt-1">
            {editAthlete && (
              <Link
                href={`/${locale}/coach/athletes/${editAthlete.id}`}
                onClick={closeModals}
                className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:underline"
              >
                {t('viewProfile')} →
              </Link>
            )}
            <div className="flex gap-2 ml-auto">
              <SecondaryButton onClick={closeModals}>{tC('cancel')}</SecondaryButton>
              <PrimaryButton
                onClick={() => handleSave(editAthlete?.id)}
                disabled={!formValid || saveMut.isPending}
              >
                {saveMut.isPending ? tC('loading') : tC('save')}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add athlete modal */}
      <Modal open={addOpen} onClose={closeModals} title={t('addAthlete')}>
        <div className="space-y-5">
          {athleteForm}
          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={closeModals}>{tC('cancel')}</SecondaryButton>
            <PrimaryButton
              onClick={() => handleSave()}
              disabled={!formValid || saveMut.isPending}
            >
              {saveMut.isPending ? tC('loading') : tC('save')}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
