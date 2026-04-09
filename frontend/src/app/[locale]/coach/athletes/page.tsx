'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileBadge2,
  Info,
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
import { apiGet, apiPost } from '@/lib/api/client';
import type { AthleteRow } from '@/types/api';

const EMPTY_SEX = '__none__';

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

export default function CoachAthletesPage() {
  const t = useTranslations('coach.athletes');
  const tC = useTranslations('common');
  const tAth = useTranslations('athletes');
  const tProfile = useTranslations('athleteProfile.identity');
  const locale = useLocale();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [infoAthlete, setInfoAthlete] = useState<AthleteRow | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [sex, setSex] = useState<'MALE' | 'FEMALE' | ''>('');

  const queryPath = search.trim()
    ? `/api/athletes?search=${encodeURIComponent(search.trim())}`
    : '/api/athletes';
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

  function formatDob(value: string | null | undefined) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString(locale);
    } catch {
      return '—';
    }
  }

  function getInitials(a: AthleteRow) {
    return `${a.firstName.charAt(0)}${a.lastName.charAt(0)}`.toUpperCase();
  }

  const rows = athletes ?? [];

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
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-48 pl-9 bg-[var(--color-surface)]"
              />
            </div>
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
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
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
                    className="border-t border-[var(--color-border)] bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AthleteAvatar initials={getInitials(a)} size="sm" />
                        <Link
                          href={`/${locale}/coach/athletes/${a.id}`}
                          className="font-medium text-[var(--color-text)] hover:underline"
                        >
                          {a.firstName} {a.lastName}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {formatDob(a.dateOfBirth)}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-muted)] md:table-cell">
                      {a.documentId || '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--color-text-muted)] lg:table-cell">
                      {a.sex ? tProfile(`sexValue.${a.sex}`) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setInfoAthlete(a)}
                        aria-label={t('viewInfo')}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {rows.map((a) => (
              <div
                key={a.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center gap-3">
                  <AthleteAvatar initials={getInitials(a)} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${locale}/coach/athletes/${a.id}`}
                      className="block truncate text-[14px] font-semibold text-[var(--color-text)] hover:underline"
                    >
                      {a.firstName} {a.lastName}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {formatDob(a.dateOfBirth)}
                      {a.sex ? ` · ${tProfile(`sexValue.${a.sex}`)}` : ''}
                    </p>
                    {!a.documentId && (
                      <span className="mt-1 inline-flex rounded-full bg-[var(--color-warning-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-warning)]">
                        {t('missingDocument')}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setInfoAthlete(a)}
                      aria-label={t('viewInfo')}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/${locale}/coach/athletes/${a.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
                      aria-label={t('viewProfile')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick-view info modal */}
      <Modal
        open={!!infoAthlete}
        onClose={() => setInfoAthlete(null)}
        title={infoAthlete ? `${infoAthlete.firstName} ${infoAthlete.lastName}` : ''}
      >
        {infoAthlete && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-primary)] text-lg font-semibold uppercase tracking-[0.1em] text-white">
                {getInitials(infoAthlete)}
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[var(--color-text)]">
                  {infoAthlete.firstName} {infoAthlete.lastName}
                </p>
                {infoAthlete.sex && (
                  <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
                    {tProfile(`sexValue.${infoAthlete.sex}`)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {tAth('columns.dob')}
                </div>
                <p className="text-[14px] font-medium text-[var(--color-text)]">
                  {formatDob(infoAthlete.dateOfBirth)}
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <UserRound className="h-3.5 w-3.5" />
                  {tAth('columns.sex')}
                </div>
                <p className="text-[14px] font-medium text-[var(--color-text)]">
                  {infoAthlete.sex ? tProfile(`sexValue.${infoAthlete.sex}`) : '—'}
                </p>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <FileBadge2 className="h-3.5 w-3.5" />
                  {tAth('columns.document')}
                </div>
                {infoAthlete.documentId ? (
                  <p className="text-[14px] font-medium text-[var(--color-text)]">{infoAthlete.documentId}</p>
                ) : (
                  <span className="rounded-full bg-[var(--color-warning-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-warning)]">
                    {t('missingDocument')}
                  </span>
                )}
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <Building2 className="h-3.5 w-3.5" />
                  {tAth('columns.club')}
                </div>
                {infoAthlete.club ? (
                  <div>
                    <p className="text-[14px] font-medium text-[var(--color-text)]">{infoAthlete.club.name}</p>
                    {(infoAthlete.club.city || infoAthlete.club.country) && (
                      <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                        {[infoAthlete.club.city, infoAthlete.club.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-[13px] text-[var(--color-text-muted)]">—</span>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <SecondaryButton onClick={() => setInfoAthlete(null)}>{tC('close')}</SecondaryButton>
              <Link href={`/${locale}/coach/athletes/${infoAthlete.id}`}>
                <PrimaryButton onClick={() => setInfoAthlete(null)}>{t('viewProfile')}</PrimaryButton>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* Add athlete modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addAthlete')}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('fields.firstName')} *</Label>
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.lastName')} *</Label>
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-10 bg-[var(--color-surface)]"
            />
          </div>
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
            <Label>{t('fields.documentId')}</Label>
            <Input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
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
          <div className="flex justify-end gap-2 pt-1">
            <SecondaryButton onClick={() => setAddOpen(false)}>{tC('cancel')}</SecondaryButton>
            <PrimaryButton
              onClick={handleAdd}
              disabled={!firstName.trim() || !lastName.trim() || !dateOfBirth || createMut.isPending}
            >
              {createMut.isPending ? tC('loading') : tC('save')}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
