'use client';

import { useTranslations } from 'next-intl';
import { INPUT_CLASS } from './categoryTemplate.constants';
import type { CategoryTemplateStatus, CategoryTemplateType } from '@/types/api';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';

const EMPTY_STATUS = '__all_status__';
const EMPTY_TYPE = '__all_type__';

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
        <Label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
          {tCommon('search')}
        </Label>
        <input
          type="search"
          className={INPUT_CLASS}
          value={search}
          placeholder={t('filters.searchPlaceholder')}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:w-[340px]">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
            {t('filters.status')}
          </Label>
          <Select
            value={status === 'ALL' ? EMPTY_STATUS : status}
            onValueChange={(v) =>
              onStatusChange(v === EMPTY_STATUS ? 'ALL' : (v as CategoryTemplateStatus))
            }
          >
            <SelectTrigger className="h-10 bg-[var(--color-surface)] px-3">
              <SelectValue placeholder={t('filters.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_STATUS}>{t('filters.allStatuses')}</SelectItem>
              <SelectItem value="ACTIVE">{t('status.active')}</SelectItem>
              <SelectItem value="DRAFT">{t('status.draft')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
            {t('filters.type')}
          </Label>
          <Select
            value={type === 'ALL' ? EMPTY_TYPE : type}
            onValueChange={(v) =>
              onTypeChange(v === EMPTY_TYPE ? 'ALL' : (v as CategoryTemplateType))
            }
          >
            <SelectTrigger className="h-10 bg-[var(--color-surface)] px-3">
              <SelectValue placeholder={t('filters.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_TYPE}>{t('filters.allTypes')}</SelectItem>
              <SelectItem value="CUSTOM">{t('type.custom')}</SelectItem>
              <SelectItem value="SYSTEM">{t('type.system')}</SelectItem>
              <SelectItem value="OFFICIAL">{t('type.official')}</SelectItem>
            </SelectContent>
          </Select>
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
