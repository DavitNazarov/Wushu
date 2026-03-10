'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { DrawCategoryDetailsResponse } from '@/types/api';

export function useDrawCategoryDetails(input: {
  eventId: string;
  eventWeightCategoryId: string;
}) {
  return useQuery({
    queryKey: ['draw-category-details', input.eventId, input.eventWeightCategoryId],
    queryFn: () =>
      apiGet<DrawCategoryDetailsResponse>(
        `/api/draw/category?eventId=${input.eventId}&eventWeightCategoryId=${input.eventWeightCategoryId}`,
      ),
    enabled: Boolean(input.eventId && input.eventWeightCategoryId),
  });
}
