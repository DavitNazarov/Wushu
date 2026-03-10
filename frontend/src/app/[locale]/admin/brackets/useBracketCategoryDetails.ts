import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { BracketCategoryDetailsResponse } from '@/types/api';

export function useBracketCategoryDetails(input: {
  eventId: string;
  eventWeightCategoryId: string;
}) {
  const { eventId, eventWeightCategoryId } = input;

  return useQuery({
    queryKey: ['bracket-category-details', eventId, eventWeightCategoryId],
    queryFn: () =>
      apiGet<BracketCategoryDetailsResponse>(
        `/api/brackets/category?eventId=${eventId}&eventWeightCategoryId=${eventWeightCategoryId}`,
      ),
    enabled: Boolean(eventId && eventWeightCategoryId),
  });
}
