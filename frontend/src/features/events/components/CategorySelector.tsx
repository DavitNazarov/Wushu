'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Layers3 } from 'lucide-react';
import { Checkbox } from '@/components/ui/primitives/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { apiGet } from '@/lib/api/client';
import type {
  CategorySelection,
  CategoryTemplateGroupRow,
  CategoryTemplateRow,
} from '@/types/api';
import {
  formatAgeGroupLabel,
  formatRoundDurationLabel,
  formatWeightCategoryLabel,
} from '@/features/events/lib/categoryTemplateLabels';

interface Props {
  categoryTemplates: CategoryTemplateRow[];
  value: CategorySelection | null;
  onChange: (value: CategorySelection) => void;
  error?: string | null;
}

function AgeGroupSection({
  ageGroup,
  selectedWeightCategoryIds,
  onToggleAll,
  onToggleWeightCategory,
}: {
  ageGroup: CategoryTemplateGroupRow;
  selectedWeightCategoryIds: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleWeightCategory: (id: string, checked: boolean) => void;
}) {
  const tIdentity = useTranslations('athleteProfile.identity');
  const tCategoryTemplates = useTranslations('admin.events.categoryTemplates');
  const [open, setOpen] = useState(false);
  const allSelected = ageGroup.weightCategories.every((wc) => selectedWeightCategoryIds.has(wc.id));
  const anySelected = ageGroup.weightCategories.some((wc) => selectedWeightCategoryIds.has(wc.id));
  const selectedCount = ageGroup.weightCategories.filter((wc) => selectedWeightCategoryIds.has(wc.id)).length;
  const divisionLabel = ageGroup.sex
    ? tIdentity(`sexValue.${ageGroup.sex}`)
    : tCategoryTemplates('openDivision');
  const ageLabel = formatAgeGroupLabel(ageGroup.minAge, ageGroup.maxAge, tCategoryTemplates);
  const roundDurationLabel = ageGroup.roundDurationSeconds
    ? formatRoundDurationLabel(ageGroup.roundDurationSeconds, tCategoryTemplates)
    : '';

  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-[var(--color-surface-alt)]/70"
      >
        <div className="min-w-0 flex items-center gap-3">
          <label className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={allSelected ? true : anySelected ? 'indeterminate' : false}
              onCheckedChange={(checked) => onToggleAll(checked === true)}
              className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-0 data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)] data-[state=indeterminate]:border-[var(--color-primary)] data-[state=indeterminate]:bg-[var(--color-primary)]"
            />
            <span className="text-[14px] font-semibold text-[var(--color-text)]">{ageGroup.name}</span>
          </label>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {divisionLabel}
              </span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {ageLabel}
              </span>
              <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                {selectedCount}/{ageGroup.weightCategories.length}
              </span>
            </div>
            {roundDurationLabel ? (
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {roundDurationLabel}
              </p>
            ) : null}
          </div>
        </div>
        <span className="ml-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open ? (
        <div className="grid grid-cols-1 gap-2 border-t border-[var(--color-border)]/80 bg-[var(--color-surface-alt)]/70 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
          {ageGroup.weightCategories.map((weightCategory) => {
            const label = formatWeightCategoryLabel(
              weightCategory.minWeightKgExcl,
              weightCategory.maxWeightKgIncl,
              tCategoryTemplates,
            );

            return (
              <label
                key={weightCategory.id}
                className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 transition hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5"
                title={label}
              >
                <Checkbox
                  checked={selectedWeightCategoryIds.has(weightCategory.id)}
                  onCheckedChange={(checked) => onToggleWeightCategory(weightCategory.id, checked === true)}
                  className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-0 data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)]"
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--color-text)]">
                    {weightCategory.name}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">{label}</div>
                </div>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CategorySelector({
  categoryTemplates,
  value,
  onChange,
  error,
}: Props) {
  const tCategoryTemplates = useTranslations('admin.events.categoryTemplates');
  const selectedCategoryTemplateId = value?.categoryTemplateId ?? categoryTemplates[0]?.id ?? '';

  const { data: ageGroups, isLoading } = useQuery({
    queryKey: ['category-template-groups', selectedCategoryTemplateId],
    queryFn: () =>
      apiGet<CategoryTemplateGroupRow[]>(
        `/api/category-templates/${selectedCategoryTemplateId}/categories`,
      ),
    enabled: !!selectedCategoryTemplateId,
  });

  const selectedWeightCategoryIds = new Set(
    (value?.ageGroups ?? []).flatMap((ageGroup) => ageGroup.weightCategoryIds),
  );

  function buildSelection(nextWeightCategoryIds: Set<string>): CategorySelection {
    return {
      categoryTemplateId: selectedCategoryTemplateId,
      ageGroups: (ageGroups ?? [])
        .map((ageGroup) => ({
          categoryTemplateGroupId: ageGroup.id,
          weightCategoryIds: ageGroup.weightCategories
            .filter((weightCategory) => nextWeightCategoryIds.has(weightCategory.id))
            .map((weightCategory) => weightCategory.id),
        }))
        .filter((ageGroup) => ageGroup.weightCategoryIds.length > 0),
    };
  }

  function handleToggleWeightCategory(weightCategoryId: string, checked: boolean) {
    const nextWeightCategoryIds = new Set(selectedWeightCategoryIds);
    if (checked) {
      nextWeightCategoryIds.add(weightCategoryId);
    } else {
      nextWeightCategoryIds.delete(weightCategoryId);
    }
    onChange(buildSelection(nextWeightCategoryIds));
  }

  function handleToggleAll(ageGroup: CategoryTemplateGroupRow, checked: boolean) {
    const nextWeightCategoryIds = new Set(selectedWeightCategoryIds);
    ageGroup.weightCategories.forEach((weightCategory) => {
      if (checked) {
        nextWeightCategoryIds.add(weightCategory.id);
      } else {
        nextWeightCategoryIds.delete(weightCategory.id);
      }
    });
    onChange(buildSelection(nextWeightCategoryIds));
  }

  function handleCategoryTemplateChange(nextCategoryTemplateId: string) {
    onChange({ categoryTemplateId: nextCategoryTemplateId, ageGroups: [] });
  }

  const totalSelected = selectedWeightCategoryIds.size;
  const selectedTemplate = categoryTemplates.find((template) => template.id === selectedCategoryTemplateId);

  return (
    <div className="space-y-3">
      <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-primary)]">
              <Layers3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                {tCategoryTemplates('sectionEyebrow')}
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[var(--color-text)]">
                {selectedTemplate?.name ?? tCategoryTemplates('loading')}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {tCategoryTemplates('sectionDescription')}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
            {tCategoryTemplates('selectedCount', { count: totalSelected })}
          </span>
        </div>

        <div className="mt-4">
          <Select value={selectedCategoryTemplateId} onValueChange={handleCategoryTemplateChange}>
            <SelectTrigger className="h-11 w-full rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] shadow-none focus:border-[var(--color-primary)] focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] shadow-xl">
              {categoryTemplates.map((template) => (
                <SelectItem
                  key={template.id}
                  value={template.id}
                  className="rounded-[10px] py-2 text-[13px]"
                >
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? <p className="text-[12px] text-[var(--color-danger)]">{error}</p> : null}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-14 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(ageGroups ?? []).map((ageGroup) => (
            <AgeGroupSection
              key={ageGroup.id}
              ageGroup={ageGroup}
              selectedWeightCategoryIds={selectedWeightCategoryIds}
              onToggleAll={(checked) => handleToggleAll(ageGroup, checked)}
              onToggleWeightCategory={handleToggleWeightCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
