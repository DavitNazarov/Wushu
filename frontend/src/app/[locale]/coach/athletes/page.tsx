'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/primitives/input';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { useCurrentUser, useIsGeorgian } from '@/hooks/useCurrentUser';
import type { AthleteRow } from '@/types/api';

import { EMPTY_ATHLETE_FORM, PAGE_SIZE, type AthleteFormState } from './athletes.types';
import { toDateInput } from './athletes.utils';
import { AthletesDesktopTable } from './components/AthletesDesktopTable';
import { AthletesMobileList } from './components/AthletesMobileList';
import { AthletesPagination } from './components/AthletesPagination';
import { AthleteAddModal } from './components/AthleteAddModal';
import { AthleteEditModal } from './components/AthleteEditModal';

export default function CoachAthletesPage() {
  const t = useTranslations('coach.athletes');
  const tC = useTranslations('common');
  const tAth = useTranslations('athletes');
  const locale = useLocale();
  const { toast } = useToast();

  const { data: currentUser } = useCurrentUser();
  const isGeorgian = useIsGeorgian(currentUser?.nationality);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editAthlete, setEditAthlete] = useState<AthleteRow | null>(null);
  const [form, setForm] = useState<AthleteFormState>(EMPTY_ATHLETE_FORM);
  const [docIdError, setDocIdError] = useState<string | null>(null);

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
    setForm(EMPTY_ATHLETE_FORM);
    setDocIdError(null);
  }

  function openAdd() {
    closeModals();
    setAddOpen(true);
  }

  function openEdit(a: AthleteRow) {
    setForm({
      firstName: a.firstName,
      lastName: a.lastName,
      firstNameKa: a.firstNameKa ?? '',
      lastNameKa: a.lastNameKa ?? '',
      dateOfBirth: toDateInput(a.dateOfBirth),
      documentId: a.documentId ?? '',
      sex: a.sex ?? '',
    });
    setDocIdError(null);
    setEditAthlete(a);
  }

  function handleSave(editingId?: string) {
    setDocIdError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      toast('Date must be YYYY-MM-DD', 'error');
      return;
    }
    if (!form.documentId.trim()) {
      setDocIdError(isGeorgian ? t('errors.nationalIdRequired') : t('errors.passportRequired'));
      return;
    }
    if (isGeorgian && !/^\d{11}$/.test(form.documentId.trim())) {
      setDocIdError(t('errors.nationalIdFormat'));
      return;
    }

    saveMut.mutate({
      id: editingId,
      firstName: form.firstName.trim(),
      firstNameKa: isGeorgian ? form.firstNameKa.trim() || null : null,
      lastName: form.lastName.trim(),
      lastNameKa: isGeorgian ? form.lastNameKa.trim() || null : null,
      dateOfBirth: form.dateOfBirth,
      documentId: form.documentId.trim(),
      sex: form.sex || undefined,
    });
  }

  const allRows = athletes ?? [];
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = allRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasKaNames = !isGeorgian || (!!form.firstNameKa.trim() && !!form.lastNameKa.trim());
  const hasValidDocId =
    !!form.documentId.trim() &&
    (!isGeorgian || /^\d{11}$/.test(form.documentId.trim()));
  const formValid =
    !!form.firstName.trim() && !!form.lastName.trim() && !!form.dateOfBirth && hasKaNames && hasValidDocId;

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
          <AthletesDesktopTable rows={rows} locale={locale} onEdit={openEdit} />
          <AthletesMobileList rows={rows} locale={locale} onEdit={openEdit} />
          <AthletesPagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <AthleteEditModal
        athlete={editAthlete}
        onClose={closeModals}
        form={form}
        setForm={setForm}
        isGeorgian={isGeorgian}
        docIdError={docIdError}
        setDocIdError={setDocIdError}
        formValid={formValid}
        saving={saveMut.isPending}
        onSave={() => handleSave(editAthlete?.id)}
        locale={locale}
      />

      <AthleteAddModal
        open={addOpen}
        onClose={closeModals}
        form={form}
        setForm={setForm}
        isGeorgian={isGeorgian}
        docIdError={docIdError}
        setDocIdError={setDocIdError}
        formValid={formValid}
        saving={saveMut.isPending}
        onSave={() => handleSave()}
      />
    </div>
  );
}
