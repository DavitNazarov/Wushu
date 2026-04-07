'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AdminEventSelect } from '@/components/admin/AdminEventSelect';
import {
  AdminFilterSelect,
  type AdminFilterOption,
} from '@/components/admin/AdminFilterSelect';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import type { ClubRow, EventRow } from '@/types/api';

const STATUS_VALUES = [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
  'PENDING',
] as const;

type Props = {
  eventId: string;
  status: string;
  clubId: string;
  categoryCode: string;
  query: string;
  events: EventRow[] | undefined;
  clubs: ClubRow[] | undefined;
  categories: string[];
  showFilters: boolean;
  hasActiveFilters: boolean;
  onEventChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onClubChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onClearFilters: () => void;
};

export function RegistrationFilters({
  eventId,
  status,
  clubId,
  categoryCode,
  query,
  events,
  clubs,
  categories,
  showFilters,
  hasActiveFilters,
  onEventChange,
  onStatusChange,
  onClubChange,
  onCategoryChange,
  onQueryChange,
  onClearFilters,
}: Props) {
  const t = useTranslations('registrations');

  const statusOptions = useMemo<AdminFilterOption[]>(
    () =>
      STATUS_VALUES.map((value) => ({
        value,
        label: t(`status.${value}`),
      })),
    [t],
  );

  const clubOptions = useMemo<AdminFilterOption[]>(
    () => (clubs ?? []).map((club) => ({ value: club.id, label: club.name })),
    [clubs],
  );

  const categoryOptions = useMemo<AdminFilterOption[]>(
    () =>
      [
        ...(categoryCode && !categories.includes(categoryCode) ? [categoryCode] : []),
        ...categories,
      ].map((value) => ({ value, label: value })),
    [categories, categoryCode],
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
      <AdminEventSelect
        label={t('eventLabel')}
        value={eventId}
        placeholder={t('selectEventPlaceholder')}
        events={events}
        onValueChange={onEventChange}
      />

      {eventId && showFilters ? (
        <>
          <AdminFilterSelect
            label={t('filterStatus')}
            value={status}
            emptyLabel={t('filterStatusAll')}
            options={statusOptions}
            onValueChange={onStatusChange}
          />

          <AdminFilterSelect
            label={t('filterClub')}
            value={clubId}
            emptyLabel={t('filterClubAll')}
            options={clubOptions}
            onValueChange={onClubChange}
          />

          <AdminFilterSelect
            label={t('filterCategory')}
            value={categoryCode}
            emptyLabel={t('filterCategoryAll')}
            options={categoryOptions}
            onValueChange={onCategoryChange}
            fallbackLabel={categoryCode}
          />

          <div className="flex min-w-[14rem] flex-col gap-1">
            <Label
              htmlFor="registration-search-filter"
              className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]"
            >
              {t('filterSearchLabel')}
            </Label>
            <Input
              id="registration-search-filter"
              type="search"
              placeholder={t('filterSearch')}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="h-10 bg-[var(--color-surface)]"
              autoComplete="off"
            />
          </div>

          {hasActiveFilters ? (
            <SecondaryButton onClick={onClearFilters} className="self-end">
              {t('clearFilters')}
            </SecondaryButton>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
