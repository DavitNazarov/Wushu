'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import type { AthleteRow } from '@/types/api';

export default function CoachAthletesPage() {
  const t = useTranslations('coach.athletes');
  const tC = useTranslations('common');
  const tAth = useTranslations('athletes');
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [sex, setSex] = useState<'MALE' | 'FEMALE' | ''>('');

  const queryPath = search.trim() ? `/api/athletes?search=${encodeURIComponent(search.trim())}` : '/api/athletes';
  const { data: athletes, isLoading, error, refetch } = useQuery({
    queryKey: ['athletes', search],
    queryFn: () => apiGet<AthleteRow[]>(queryPath),
  });

  const createMut = useMutation({
    mutationFn: (body: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      documentId?: string;
      sex?: 'MALE' | 'FEMALE';
    }) => apiPost<{ athlete: AthleteRow }>('/api/athletes', body),
    onSuccess: () => {
      refetch();
      setAddOpen(false);
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setDocumentId('');
      setSex('');
      toast(tC('saveSuccess'));
    },
    onError: (e: { message?: string }) => toast(e?.message ?? tC('error'), 'error'),
  });

  const handleAdd = () => {
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      toast('Date must be YYYY-MM-DD', 'error');
      return;
    }
    createMut.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      documentId: documentId.trim() || undefined,
      sex: sex || undefined,
    });
  };

  const rows = athletes ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex gap-2">
            <input
              type="search"
              placeholder={tAth('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-48 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] outline-none focus:border-[var(--color-primary)]"
            />
            <SecondaryButton onClick={() => setAddOpen(true)}>{t('addAthlete')}</SecondaryButton>
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
        <SkeletonRows rows={5} cols={4} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-[var(--color-surface-alt)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tAth('columns.name')}</th>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tAth('columns.dob')}</th>
                <th className="px-4 py-3 font-medium text-[var(--color-text-muted)]">{tAth('columns.document')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">
                    {a.firstName} {a.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">{a.documentId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addAthlete')}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">First name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">Last name *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">Date of birth (YYYY-MM-DD) *</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">Document ID</label>
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">Sex</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as 'MALE' | 'FEMALE' | '')}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            >
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setAddOpen(false)}>{tC('cancel')}</SecondaryButton>
            <button
              onClick={handleAdd}
              disabled={!firstName.trim() || !lastName.trim() || !dateOfBirth || createMut.isPending}
              className="h-10 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-70"
            >
              {createMut.isPending ? tC('loading') : tC('save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
