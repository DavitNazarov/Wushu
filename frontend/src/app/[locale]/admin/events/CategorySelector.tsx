'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { RulesetRow, RulesetAgeGroupRow, CategorySelection } from '@/types/api';

interface Props {
  rulesets: RulesetRow[];
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
  ag: RulesetAgeGroupRow;
  selected: Set<string>;
  onToggleAll: (check: boolean) => void;
  onToggleWc: (id: string, check: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const allSelected = ag.weightCategories.every((wc) => selected.has(wc.id));
  const anySelected = ag.weightCategories.some((wc) => selected.has(wc.id));

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-3">
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
          <span className="text-[12px] text-[var(--color-text-muted)]">
            {ag.minAge ? `${ag.minAge}${ag.maxAge ? `–${ag.maxAge}` : '+'}y` : ''}
            {ag.roundDurationSeconds ? ` · ${ag.roundDurationSeconds / 60}min` : ''}
          </span>
          <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
            {ag.weightCategories.filter((wc) => selected.has(wc.id)).length}/{ag.weightCategories.length}
          </span>
        </div>
        <svg className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:grid-cols-3 md:grid-cols-4">
          {ag.weightCategories.map((wc) => (
            <label key={wc.id}
              className="flex cursor-pointer items-start gap-2 rounded-[6px] border border-[var(--color-border)] px-2.5 py-2 transition hover:bg-[var(--color-surface-alt)]"
              title={weightLabel(wc.minWeightKgExcl, wc.maxWeightKgIncl)}
            >
              <input
                type="checkbox"
                checked={selected.has(wc.id)}
                onChange={(e) => onToggleWc(wc.id, e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
              />
              <div>
                <div className="text-[13px] font-medium text-[var(--color-text)]">{wc.name}</div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
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

export function CategorySelector({ rulesets, value, onChange, error }: Props) {
  const selectedRulesetId = value?.rulesetId ?? rulesets[0]?.id ?? '';

  const { data: ageGroups, isLoading } = useQuery({
    queryKey: ['ruleset-age-groups', selectedRulesetId],
    queryFn: () => apiGet<RulesetAgeGroupRow[]>(`/api/rulesets/${selectedRulesetId}/age-groups`),
    enabled: !!selectedRulesetId,
  });

  // Build a Set<wcId> for fast lookup
  const selectedWcIds = new Set(
    (value?.ageGroups ?? []).flatMap((ag) => ag.weightCategoryIds),
  );

  function buildSelection(newWcIds: Set<string>): CategorySelection {
    return {
      rulesetId: selectedRulesetId,
      ageGroups: (ageGroups ?? [])
        .map((ag) => ({
          rulesetAgeGroupId: ag.id,
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

  function handleToggleAll(ag: RulesetAgeGroupRow, checked: boolean) {
    const next = new Set(selectedWcIds);
    ag.weightCategories.forEach((wc) => (checked ? next.add(wc.id) : next.delete(wc.id)));
    onChange(buildSelection(next));
  }

  function handleRulesetChange(id: string) {
    onChange({ rulesetId: id, ageGroups: [] });
  }

  const totalSelected = selectedWcIds.size;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            value={selectedRulesetId}
            onChange={(e) => handleRulesetChange(e.target.value)}
          >
            {rulesets.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {totalSelected} {totalSelected === 1 ? 'category' : 'categories'} selected
        </span>
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
        <div className="space-y-2">
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
