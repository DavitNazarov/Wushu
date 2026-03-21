'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { apiGet } from '@/lib/api/client';
import type { CategorySelection, CategoryTemplateRow } from '@/types/api';
import { CategorySelector } from './CategorySelector';

type Props = {
  open: boolean;
  value: CategorySelection | null;
  onChange: (value: CategorySelection) => void;
  error?: string | null;
  showSelectionError?: boolean;
  embedded?: boolean;
};

export function EventCategoryTemplatePanel({
  open,
  value,
  onChange,
  error,
  showSelectionError,
  embedded = false,
}: Props) {
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');

  const {
    data: categoryTemplates,
    error: categoryTemplatesError,
    refetch,
  } = useQuery({
    queryKey: ['category-templates'],
    queryFn: () => apiGet<CategoryTemplateRow[]>('/api/category-templates'),
    enabled: open,
  });

  const totalSelected = (value?.ageGroups ?? []).reduce(
    (sum, ageGroup) => sum + ageGroup.weightCategoryIds.length,
    0,
  );

  const content = (
    <>
      {categoryTemplatesError && (
        <div className="mb-3">
          <AdminErrorAlert
            error={categoryTemplatesError}
            fallbackMessage={tEvents('categoryTemplates.loadError')}
            retryLabel={tCommon('retry')}
            onRetry={() => refetch()}
          />
        </div>
      )}
      {categoryTemplates && categoryTemplates.length > 0 ? (
        <CategorySelector
          categoryTemplates={categoryTemplates}
          value={value}
          onChange={onChange}
          error={error}
        />
      ) : (
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {tEvents('categoryTemplates.loading')}
        </p>
      )}
      {showSelectionError && totalSelected === 0 && (
        <p className="mt-2 text-[12px] text-[var(--color-danger)]">
          {tEvents('categoryTemplates.required')}
        </p>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {tEvents('categoryTemplates.sectionTitle')}
      </p>
      {content}
    </div>
  );
}
