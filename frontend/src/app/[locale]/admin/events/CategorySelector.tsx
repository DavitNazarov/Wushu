'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Layers3 } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import type {
  CategorySelection,
  CategoryTemplateGroupRow,
  CategoryTemplateRow,
} from '@/types/api';

interface Props {
  categoryTemplates: CategoryTemplateRow[];
  value: CategorySelection | null;
  onChange: (v: CategorySelection) => void;
  error?: string | null;
}

function weightLabel(min: number | null, max: number | null): string {
  if (max === null) return `> ${min}kg`;
  if (min === null) return `≤ ${max}kg`;
  return `> ${min}–≤ ${max}kg`;
}

function AgeGroupSection({
  ag,
  selected,
  onToggleAll,
  onToggleWc,
}: {
  ag: CategoryTemplateGroupRow;
  selected: Set<string>;
  onToggleAll: (check: boolean) => void;
  onToggleWc: (id: string, check: boolean) => void;
}) {
  const tIdentity = useTranslations('athleteProfile.identity');
  const [open, setOpen] = useState(false);
  const allSelected = ag.weightCategories.every((wc) => selected.has(wc.id));
  const anySelected = ag.weightCategories.some((wc) => selected.has(wc.id));
  const selectedCount = ag.weightCategories.filter((wc) => selected.has(wc.id)).length;
  const divisionLabel = ag.sex ? tIdentity(`sexValue.${ag.sex}`) : 'Open';
  const ageLabel = ag.minAge
    ? `${ag.minAge}${ag.maxAge ? `-${ag.maxAge}` : '+'}y`
    : 'Open';

  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-[var(--color-surface-alt)]/70"
      >
        <div className="min-w-0 flex items-center gap-3">
          <label
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = !allSelected && anySelected; }}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="text-[14px] font-semibold text-[var(--color-text)]">{ag.name}</span>
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
                {selectedCount}/{ag.weightCategories.length}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              {ag.roundDurationSeconds ? `${ag.roundDurationSeconds / 60} min rounds` : ''}
            </p>
          </div>
        </div>
        <span className="ml-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-2 border-t border-[var(--color-border)]/80 bg-[var(--color-surface-alt)]/70 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
          {ag.weightCategories.map((wc) => (
            <label key={wc.id}
              className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 transition hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5"
              title={weightLabel(wc.minWeightKgExcl, wc.maxWeightKgIncl)}
            >
              <input
                type="checkbox"
                checked={selected.has(wc.id)}
                onChange={(e) => onToggleWc(wc.id, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--color-text)]">{wc.name}</div>
                <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {weightLabel(wc.minWeightKgExcl, wc.maxWeightKgIncl)}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategorySelector({
  categoryTemplates,
  value,
  onChange,
  error,
}: Props) {
  const t = useTranslations('admin.events.categoryTemplates');
  const selectedCategoryTemplateId =
    value?.categoryTemplateId ?? categoryTemplates[0]?.id ?? '';

  const { data: ageGroups, isLoading } = useQuery({
    queryKey: ['category-template-groups', selectedCategoryTemplateId],
    queryFn: () =>
      apiGet<CategoryTemplateGroupRow[]>(
        `/api/category-templates/${selectedCategoryTemplateId}/categories`,
      ),
    enabled: !!selectedCategoryTemplateId,
  });

  // Build a Set<wcId> for fast lookup
  const selectedWcIds = new Set(
    (value?.ageGroups ?? []).flatMap((ag) => ag.weightCategoryIds),
  );

  function buildSelection(newWcIds: Set<string>): CategorySelection {
    return {
      categoryTemplateId: selectedCategoryTemplateId,
      ageGroups: (ageGroups ?? [])
        .map((ag) => ({
          categoryTemplateGroupId: ag.id,
          weightCategoryIds: ag.weightCategories.filter((wc) => newWcIds.has(wc.id)).map((wc) => wc.id),
        }))
        .filter((ag) => ag.weightCategoryIds.length > 0),
    };
  }

  function handleToggleWc(wcId: string, checked: boolean) {
    const next = new Set(selectedWcIds);
    if (checked) {
      next.add(wcId);
    } else {
      next.delete(wcId);
    }
    onChange(buildSelection(next));
  }

  function handleToggleAll(ag: CategoryTemplateGroupRow, checked: boolean) {
    const next = new Set(selectedWcIds);
    ag.weightCategories.forEach((wc) => (checked ? next.add(wc.id) : next.delete(wc.id)));
    onChange(buildSelection(next));
  }

  function handleCategoryTemplateChange(id: string) {
    onChange({ categoryTemplateId: id, ageGroups: [] });
  }

  const totalSelected = selectedWcIds.size;
  const selectedTemplate = categoryTemplates.find((row) => row.id === selectedCategoryTemplateId);

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
                {t('sectionEyebrow')}
              </p>
              <p className="mt-1 text-[15px] font-semibold text-[var(--color-text)]">
                {selectedTemplate?.name ?? t('loading')}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {t('sectionDescription')}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
            {t('selectedCount', { count: totalSelected })}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <select
            className="h-11 w-full rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            value={selectedCategoryTemplateId}
            onChange={(e) => handleCategoryTemplateChange(e.target.value)}
          >
            {categoryTemplates.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(ageGroups ?? []).map((ag) => (
            <AgeGroupSection
              key={ag.id}
              ag={ag}
              selected={selectedWcIds}
              onToggleAll={(checked) => handleToggleAll(ag, checked)}
              onToggleWc={handleToggleWc}
            />
          ))}
        </div>
      )}
    </div>
  );
}
