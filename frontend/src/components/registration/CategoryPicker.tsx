'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import type { EventCategoriesResponse, EventAgeGroupRow, EventWeightCategoryRow, AthleteRow } from '@/types/api';

interface Props {
  /** Use eventId (admin path) OR eventSlug (coach/public path) — one required */
  eventId?: string;
  eventSlug?: string;
  ageGroupId: string;
  weightCategoryId: string;
  onAgeGroupChange: (id: string) => void;
  onWeightCategoryChange: (id: string) => void;
  disabled?: boolean;
  /** When provided, age groups are filtered to only those eligible for this athlete */
  athlete?: AthleteRow | null;
}

function weightLabel(min: number | null, max: number | null): string {
  if (max === null) return `> ${min} kg`;
  if (min === null) return `≤ ${max} kg`;
  return `> ${min} – ≤ ${max} kg`;
}

/** Returns athlete's age as of today */
function athleteAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/**
 * Returns true if an athlete of given age/sex is eligible for the age group.
 * Special rule: age 17 can also enter groups where minAge === 18.
 */
function isEligible(ag: EventAgeGroupRow, age: number, sex: string): boolean {
  // Sex filter — null means any sex
  if (ag.sex !== null && ag.sex !== sex) return false;

  const min = ag.minAge ?? 0;
  const max = ag.maxAge ?? Infinity;

  // Normal fit
  if (age >= min && age <= max) return true;

  // Special rule: 17-year-olds may also enter the 18+ age group
  if (age === 17 && min === 18) return true;

  return false;
}

export function CategoryPicker({
  eventId,
  eventSlug,
  ageGroupId,
  weightCategoryId,
  onAgeGroupChange,
  onWeightCategoryChange,
  disabled,
  athlete,
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

  const allAgeGroups: EventAgeGroupRow[] = data?.ageGroups ?? [];

  // Filter by athlete eligibility when athlete is provided
  const ageGroups: EventAgeGroupRow[] = (() => {
    if (!athlete || !athlete.dateOfBirth || !athlete.sex) return allAgeGroups;
    const age = athleteAge(athlete.dateOfBirth);
    return allAgeGroups.filter((ag) => isEligible(ag, age, athlete.sex!));
  })();

  // When categories load and we have a weightCategoryId but no ageGroupId yet,
  // auto-resolve the parent age group (used when opening the edit modal).
  useEffect(() => {
    if (!data || ageGroupId || !weightCategoryId) return;
    const parentGroup = allAgeGroups.find((ag) =>
      ag.weightCategories.some((wc) => wc.id === weightCategoryId),
    );
    if (parentGroup) onAgeGroupChange(parentGroup.id);
  }, [data, ageGroupId, weightCategoryId, allAgeGroups, onAgeGroupChange]);

  const selectedAgeGroup = allAgeGroups.find((ag) => ag.id === ageGroupId) ?? null;
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

  if (!allAgeGroups.length) {
    return (
      <p className="text-[12px] text-[var(--color-warning)]">
        No categories configured for this event. Admin must set up a category template first.
      </p>
    );
  }

  // Athlete selected but no eligible categories
  if (athlete && ageGroups.length === 0) {
    const name = `${athlete.firstName} ${athlete.lastName}`;
    return (
      <p className="rounded-[var(--radius-input)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-3 py-2.5 text-[13px] text-[var(--color-warning)]">
        {name} cannot participate — no available categories match their age and sex.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Age Group</label>
        <Select value={ageGroupId} onValueChange={handleAgeGroupChange} disabled={disabled}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Select age group…" />
          </SelectTrigger>
          <SelectContent>
            {ageGroups.map((ag) => (
              <SelectItem key={ag.id} value={ag.id}>
                {ag.name}
                {ag.minAge != null
                  ? ` (${ag.minAge}${ag.maxAge != null ? `–${ag.maxAge}` : '+'}y)`
                  : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ageGroupId && (
        <div>
          <label className="mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]">Weight Category</label>
          <Select value={weightCategoryId} onValueChange={onWeightCategoryChange} disabled={disabled || !ageGroupId}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select weight category…" />
            </SelectTrigger>
            <SelectContent>
              {weightCategories.map((wc) => (
                <SelectItem key={wc.id} value={wc.id}>
                  {wc.name} — {weightLabel(wc.minWeightKgExcl, wc.maxWeightKgIncl)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
