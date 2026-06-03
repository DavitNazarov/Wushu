'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { WeighInPreviewResponse } from '@/types/weighin';

function normalizeWeight(input: string): number | null {
  if (!input.trim()) return null;
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Number(value.toFixed(2));
}

export function useWeighInDecisionPreview(input: {
  registrationId: string | null;
  weightInput: string;
}) {
  const weightKg = useMemo(
    () => normalizeWeight(input.weightInput),
    [input.weightInput],
  );
  // PF-3: only preview after the operator stops typing for 300ms — previously
  // this POSTed to /api/weighin/preview on every digit.
  const debouncedWeightKg = useDebouncedValue(weightKg, 300);

  return useQuery({
    queryKey: ['weighin-preview', input.registrationId, debouncedWeightKg],
    enabled: Boolean(input.registrationId && debouncedWeightKg != null),
    queryFn: () =>
      apiPost<WeighInPreviewResponse>('/api/weighin/preview', {
        registrationId: input.registrationId,
        weightKg: debouncedWeightKg,
      }),
  });
}
