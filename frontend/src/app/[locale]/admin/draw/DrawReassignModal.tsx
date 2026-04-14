'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Label } from '@/components/ui/primitives/label';
import { Textarea } from '@/components/ui/primitives/textarea';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import type { EventCategoriesResponse, EventAgeGroupRow, EventWeightCategoryRow } from '@/types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  eventId: string;
  registrationId: string;
  athleteName: string;
  currentCategory: string;
  currentEventWeightCategoryId: string;
}

function weightLabel(min: number | null, max: number | null): string {
  if (max === null) return `> ${min} kg`;
  if (min === null) return `≤ ${max} kg`;
  return `> ${min} – ≤ ${max} kg`;
}

/**
 * Returns allowed target age groups and their weight categories based on rules:
 * - Same age group: same or higher weight (sortOrder >=)
 * - One age-group step up (adjacent higher sortOrder): same or higher weight
 * Age groups are sorted by sortOrder ascending (younger → older).
 */
function filterAllowedCategories(
  ageGroups: EventAgeGroupRow[],
  currentCatId: string,
): { ageGroup: EventAgeGroupRow; weights: EventWeightCategoryRow[] }[] {
  if (!currentCatId) return ageGroups.map((ag) => ({ ageGroup: ag, weights: ag.weightCategories }));

  // Find the current age group and weight category
  let currentAgeGroup: EventAgeGroupRow | null = null;
  let currentWeight: EventWeightCategoryRow | null = null;

  for (const ag of ageGroups) {
    const wc = ag.weightCategories.find((w) => w.id === currentCatId);
    if (wc) {
      currentAgeGroup = ag;
      currentWeight = wc;
      break;
    }
  }

  if (!currentAgeGroup || !currentWeight) {
    return ageGroups.map((ag) => ({ ageGroup: ag, weights: ag.weightCategories }));
  }

  const sortedAgeGroups = [...ageGroups].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentAgIdx = sortedAgeGroups.findIndex((ag) => ag.id === currentAgeGroup!.id);

  // Allowed age groups: current + exactly one step up (if same sex/open)
  const allowedAgIndices = new Set([currentAgIdx]);
  if (currentAgIdx + 1 < sortedAgeGroups.length) {
    allowedAgIndices.add(currentAgIdx + 1);
  }

  const result: { ageGroup: EventAgeGroupRow; weights: EventWeightCategoryRow[] }[] = [];

  for (const idx of [...allowedAgIndices].sort((a, b) => a - b)) {
    const ag = sortedAgeGroups[idx];
    // Filter weights: same or higher sortOrder (same or heavier weight class)
    const weights = ag.weightCategories
      .filter((w) => w.sortOrder >= currentWeight!.sortOrder && w.id !== currentCatId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (weights.length > 0) {
      result.push({ ageGroup: ag, weights });
    }
  }

  return result;
}

export function DrawReassignModal({
  open,
  onClose,
  eventId,
  registrationId,
  athleteName,
  currentCategory,
  currentEventWeightCategoryId,
}: Props) {
  const t = useTranslations('draw.reassign');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const { toast } = useToast();

  const [ageGroupId, setAgeGroupId] = useState('');
  const [weightCategoryId, setWeightCategoryId] = useState('');
  const [reason, setReason] = useState('');

  function resetForm() {
    setAgeGroupId('');
    setWeightCategoryId('');
    setReason('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const { data: catData, isLoading: catsLoading } = useQuery({
    queryKey: ['event-categories', eventId],
    queryFn: () => apiGet<EventCategoriesResponse>(`/api/events/${eventId}/categories`),
    enabled: open && !!eventId,
  });

  const allowedGroups = filterAllowedCategories(
    catData?.ageGroups ?? [],
    currentEventWeightCategoryId,
  );

  const selectedGroupWeights =
    allowedGroups.find((g) => g.ageGroup.id === ageGroupId)?.weights ?? [];

  function handleAgeGroupChange(id: string) {
    setAgeGroupId(id);
    setWeightCategoryId('');
  }

  const reassignMut = useMutation({
    mutationFn: () =>
      apiPost(`/api/registrations/${registrationId}/category`, {
        eventWeightCategoryId: weightCategoryId,
        override: true,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['draw-overview', eventId] });
      void qc.invalidateQueries({ queryKey: ['draw-category-details', eventId] });
      toast(t('successToast'));
      handleClose();
    },
    onError: (e: unknown) =>
      toast(e instanceof ApiError ? e.message : t('errorToast'), 'error'),
  });

  const canSubmit = !!weightCategoryId && reason.trim().length > 0 && !reassignMut.isPending;

  return (
    <Modal open={open} onClose={handleClose} title={t('title', { name: athleteName })}>
      <div className="space-y-4">
        {/* Current category */}
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('currentCategory')}
          </p>
          <p className="mt-0.5 text-[14px] font-medium text-[var(--color-text)]">
            {currentCategory}
          </p>
        </div>

        {/* Rule hint */}
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {t('ruleHint')}
        </p>

        {/* Age group picker */}
        {catsLoading ? (
          <div className="space-y-2">
            <div className="h-10 animate-pulse rounded-[var(--radius-input)] bg-[var(--color-surface-alt)]" />
            <div className="h-10 animate-pulse rounded-[var(--radius-input)] bg-[var(--color-surface-alt)]" />
          </div>
        ) : allowedGroups.length === 0 ? (
          <p className="rounded-[var(--radius-input)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8 px-3 py-2.5 text-[13px] text-amber-300">
            {t('noTargetsAvailable')}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-[var(--color-text-muted)]">
                {t('ageGroupLabel')}
              </Label>
              <Select value={ageGroupId} onValueChange={handleAgeGroupChange} disabled={reassignMut.isPending}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder={t('ageGroupPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allowedGroups.map(({ ageGroup: ag }) => (
                    <SelectItem key={ag.id} value={ag.id}>
                      {ag.name}
                      {ag.minAge != null
                        ? ` (${ag.minAge}${ag.maxAge != null ? `–${ag.maxAge}` : '+'})`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ageGroupId && (
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-[var(--color-text-muted)]">
                  {t('weightCategoryLabel')}
                </Label>
                <Select value={weightCategoryId} onValueChange={setWeightCategoryId} disabled={reassignMut.isPending}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder={t('weightCategoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedGroupWeights.map((wc) => (
                      <SelectItem key={wc.id} value={wc.id}>
                        {wc.name} — {weightLabel(wc.minWeightKgExcl, wc.maxWeightKgIncl)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-[var(--color-text-muted)]">
            {t('reasonLabel')} <span className="text-[var(--color-danger)]">*</span>
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            className="h-20 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={handleClose}>{tCommon('cancel')}</SecondaryButton>
          <button
            onClick={() => reassignMut.mutate()}
            disabled={!canSubmit}
            className="h-9 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {reassignMut.isPending ? tCommon('loading') : t('confirmButton')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
