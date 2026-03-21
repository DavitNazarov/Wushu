'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { EventCategoriesResponse, EventAgeGroupRow, EventWeightCategoryRow } from '@/types/api';

const SEL =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:opacity-50';

interface Props {
  /** Use eventId (admin path) OR eventSlug (coach/public path) — one required */
  eventId?: string;
  eventSlug?: string;
  ageGroupId: string;
  weightCategoryId: string;
  onAgeGroupChange: (id: string) => void;
  onWeightCategoryChange: (id: string) => void;
  disabled?: boolean;
}

function weightLabel(min: number | null, max: number | null): string {
  if (max === null) return `> ${min}kg`;
  if (min === null) return `≤ ${max}kg`;
  return `> ${min} – ≤ ${max}kg`;
}

export function CategoryPicker({
  eventId,
  eventSlug,
  ageGroupId,
  weightCategoryId,
  onAgeGroupChange,
  onWeightCategoryChange,
  disabled,
}: Props) {
  const url = eventSlug
    ? `/api/public/events/${eventSlug}/categories`
    : eventId
    ? `/api/events/${eventId}/categories`
    : null;

  const { data, isLoading } = useQuery({
    queryKey: ['event-categories', url],
    queryFn: () => apiGet<EventCategoriesResponse>(url!),
    enabled: !!url,
  });

  const ageGroups: EventAgeGroupRow[] = data?.ageGroups ?? [];
  const selectedAgeGroup = ageGroups.find((ag) => ag.id === ageGroupId) ?? null;
  const weightCategories: EventWeightCategoryRow[] = selectedAgeGroup?.weightCategories ?? [];

  function handleAgeGroupChange(id: string) {
    onAgeGroupChange(id);
    onWeightCategoryChange('');
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-10 animate-pulse rounded-[var(--radius-input)] bg-[var(--color-surface-alt)]" />
        <div className="h-10 animate-pulse rounded-[var(--radius-input)] bg-[var(--color-surface-alt)]" />
      </div>
    );
  }

  if (!ageGroups.length) {
    return (
      <p className="text-[12px] text-[var(--color-warning)]">
        No categories configured for this event. Admin must set up a category template first.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Age Group</label>
        <select
          className={SEL}
          value={ageGroupId}
          onChange={(e) => handleAgeGroupChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Select age group…</option>
          {ageGroups.map((ag) => (
            <option key={ag.id} value={ag.id}>
              {ag.name}
              {ag.minAge ? ` (${ag.minAge}${ag.maxAge ? `–${ag.maxAge}` : '+'}y)` : ''}
            </option>
          ))}
        </select>
      </div>

      {ageGroupId && (
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Weight Category</label>
          <select
            className={SEL}
            value={weightCategoryId}
            onChange={(e) => onWeightCategoryChange(e.target.value)}
            disabled={disabled || !ageGroupId}
          >
            <option value="">Select weight category…</option>
            {weightCategories.map((wc) => (
              <option key={wc.id} value={wc.id}>
                {wc.name} — {weightLabel(wc.minWeightKgExcl, wc.maxWeightKgIncl)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
