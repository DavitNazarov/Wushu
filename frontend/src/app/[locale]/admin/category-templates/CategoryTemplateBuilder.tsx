'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { INPUT_CLASS } from './categoryTemplate.constants';
import { formatWeightLabel } from './categoryTemplate.utils';
import type { CategoryOptionGroupRow, CategoryTemplateStatus } from '@/types/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';

type Props = {
  name: string;
  status: CategoryTemplateStatus;
  selectedOptionIds: string[];
  optionGroups: CategoryOptionGroupRow[];
  disableStatus?: boolean;
  onNameChange: (value: string) => void;
  onStatusChange: (value: CategoryTemplateStatus) => void;
  onSelectedOptionIdsChange: (value: string[]) => void;
};

export function CategoryTemplateBuilder({
  name,
  status,
  selectedOptionIds,
  optionGroups,
  disableStatus = false,
  onNameChange,
  onStatusChange,
  onSelectedOptionIdsChange,
}: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const selectedSet = useMemo(() => new Set(selectedOptionIds), [selectedOptionIds]);

  function toggleOption(id: string, checked: boolean) {
    onSelectedOptionIdsChange(
      checked
        ? [...new Set([...selectedOptionIds, id])]
        : selectedOptionIds.filter((item) => item !== id),
    );
  }

  function toggleGroup(group: CategoryOptionGroupRow, checked: boolean) {
    const groupOptionIds = group.options.map((option) => option.id);
    onSelectedOptionIdsChange(
      checked
        ? [...new Set([...selectedOptionIds, ...groupOptionIds])]
        : selectedOptionIds.filter((id) => !new Set(groupOptionIds).has(id)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
            {t('columns.name')}
          </label>
          <input
            className={INPUT_CLASS}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
            {t('columns.status')}
          </label>
          <Select
            value={status}
            disabled={disableStatus}
            onValueChange={(v) => onStatusChange(v as CategoryTemplateStatus)}
          >
            <SelectTrigger className="h-10 bg-[var(--color-surface)] px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">{t('status.draft')}</SelectItem>
              <SelectItem value="ACTIVE">{t('status.active')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] text-[var(--color-text-muted)]">
        <span>{t('builder.help')}</span>
        <span>{t('builder.selectedCount', { count: selectedOptionIds.length })}</span>
      </div>

      <div className="space-y-3">
        {optionGroups.map((group) => {
          const selectedCount = group.options.filter((option) => selectedSet.has(option.id)).length;
          const allSelected = selectedCount === group.options.length;
          const someSelected = selectedCount > 0 && !allSelected;

          return (
            <div
              key={group.id}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = someSelected;
                    }}
                    onChange={(event) => toggleGroup(group, event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold text-[var(--color-text)]">
                      {group.name}
                    </span>
                    <span className="block text-[12px] text-[var(--color-text-muted)]">
                      {t('builder.groupMeta', {
                        minAge: group.minAge ?? '—',
                        maxAge: group.maxAge ?? '—',
                        roundMinutes: group.roundDurationSeconds / 60,
                      })}
                    </span>
                  </span>
                </label>
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {selectedCount}/{group.options.length}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {group.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-2 rounded-[8px] border border-[var(--color-border)] px-3 py-2 transition hover:bg-[var(--color-surface-alt)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(option.id)}
                      onChange={(event) => toggleOption(option.id, event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                    />
                    <span>
                      <span className="block text-[13px] font-medium text-[var(--color-text)]">
                        {option.name}
                      </span>
                      <span className="block text-[11px] text-[var(--color-text-muted)]">
                        {formatWeightLabel(option.minWeightKgExcl, option.maxWeightKgIncl)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
