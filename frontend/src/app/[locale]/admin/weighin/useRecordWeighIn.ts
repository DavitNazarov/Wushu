'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/client';
import type { WeighInRecordInput } from '@/types/weighin';

export function useRecordWeighIn(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: WeighInRecordInput) =>
      apiPost('/api/weighin', payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['weighin', eventId] });
      queryClient.invalidateQueries({
        queryKey: ['weighin-preview', vars.registrationId],
      });
    },
  });
}
