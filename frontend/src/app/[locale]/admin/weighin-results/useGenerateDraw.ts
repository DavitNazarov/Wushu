'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/client';

export type GenerateDrawInput = {
  eventId: string;
  seed?: number;
  sameClubSeparation?: boolean;
  override?: boolean;
  reason?: string;
};

export function useGenerateDraw() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateDrawInput) =>
      apiPost('/api/draw', {
        eventId: input.eventId,
        seed: input.seed,
        sameClubSeparation: input.sameClubSeparation ?? false,
        override: input.override ?? false,
        reason: input.reason,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['draw-overview', vars.eventId] });
      qc.invalidateQueries({ queryKey: ['draw-category-details', vars.eventId] });
      qc.invalidateQueries({ queryKey: ['brackets', vars.eventId] });
    },
  });
}
