'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { WeighInListEntry } from '@/types/weighin';

export function useWeighInAthletes(input: {
  eventId: string;
  search: string;
}) {
  const searchTerm = input.search.trim();

  return useQuery({
    queryKey: ['weighin', input.eventId, searchTerm || undefined],
    enabled: Boolean(input.eventId),
    queryFn: () => {
      const params = new URLSearchParams({ eventId: input.eventId });
      if (searchTerm) params.set('q', searchTerm);
      return apiGet<WeighInListEntry[]>(`/api/weighin?${params.toString()}`);
    },
  });
}
