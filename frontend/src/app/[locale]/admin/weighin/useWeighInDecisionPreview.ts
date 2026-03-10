'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/client';
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

  return useQuery({
    queryKey: ['weighin-preview', input.registrationId, weightKg],
    enabled: Boolean(input.registrationId && weightKg != null),
    queryFn: () =>
      apiPost<WeighInPreviewResponse>('/api/weighin/preview', {
        registrationId: input.registrationId,
        weightKg,
      }),
  });
}
