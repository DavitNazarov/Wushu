'use client';

import { useTranslations } from 'next-intl';
import { INPUT_CLASS, SELECT_CLASS } from './categoryTemplate.constants';
import type { CategoryTemplateStatus, CategoryTemplateType } from '@/types/api';
import { SecondaryButton } from '@/components/ui/SecondaryButton';

type Props = {
  search: string;
  status: CategoryTemplateStatus | 'ALL';
  type: CategoryTemplateType | 'ALL';
  onSearchChange: (value: string) => void;
  onStatusChange: (value: CategoryTemplateStatus | 'ALL') => void;
  onTypeChange: (value: CategoryTemplateType | 'ALL') => void;
  onReset: () => void;
};

export function CategoryTemplateFilters({
  search,
  status,
  type,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onReset,
}: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const hasFilters = search || status !== 'ALL' || type !== 'ALL';

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {tCommon('search')}
        </label>
        <input
          type="search"
          className={INPUT_CLASS}
          value={search}
          placeholder={t('filters.searchPlaceholder')}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:w-[340px]">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('filters.status')}
          </label>
          <select
            className={SELECT_CLASS}
            value={status}
            onChange={(event) => onStatusChange(event.target.value as CategoryTemplateStatus | 'ALL')}
          >
            <option value="ALL">{t('filters.allStatuses')}</option>
            <option value="ACTIVE">{t('status.active')}</option>
            <option value="DRAFT">{t('status.draft')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('filters.type')}
          </label>
          <select
            className={SELECT_CLASS}
            value={type}
            onChange={(event) => onTypeChange(event.target.value as CategoryTemplateType | 'ALL')}
          >
            <option value="ALL">{t('filters.allTypes')}</option>
            <option value="CUSTOM">{t('type.custom')}</option>
            <option value="SYSTEM">{t('type.system')}</option>
            <option value="OFFICIAL">{t('type.official')}</option>
          </select>
        </div>
      </div>
      {hasFilters && (
        <SecondaryButton className="lg:h-10" onClick={onReset}>
          {t('filters.clear')}
        </SecondaryButton>
      )}
    </div>
  );
}
