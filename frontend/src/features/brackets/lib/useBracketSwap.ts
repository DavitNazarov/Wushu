import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api/client';

interface SwapInput {
  eventId: string;
  fightId1: string;
  side1: 'red' | 'blue';
  fightId2: string;
  side2: 'red' | 'blue';
}

export function useBracketSwap(eventId: string, eventWeightCategoryId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: SwapInput) => apiPost('/api/brackets/swap', input),
    onSuccess: () => {
      // Invalidate both the category details and the overview so fight counts update
      void qc.invalidateQueries({ queryKey: ['bracket-category-details', eventId] });
      void qc.invalidateQueries({ queryKey: ['brackets-overview', eventId] });
    },
  });
}
