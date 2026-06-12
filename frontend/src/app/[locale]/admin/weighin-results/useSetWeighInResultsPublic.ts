'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/client';

// Toggle public visibility of the confirmed weigh-in weights for an event.
// On success we re-fetch the draw overview so the header reflects the new flag.
export function useSetWeighInResultsPublic(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isPublic: boolean) =>
      apiPost<{ weighInResultsPublic: boolean }>(
        `/api/events/${eventId}/weighin-results-visibility`,
        { public: isPublic },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['draw-overview', eventId] });
    },
  });
}
