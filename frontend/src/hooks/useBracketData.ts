'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, apiGet } from '@/lib/api/client';
import type {
  PublicBracketCategoryDetailsResponse,
  PublicBracketsOverviewResponse,
} from '@/types/api';

export function usePublicBracketOverview(eventSlug: string | null) {
  return useQuery({
    queryKey: ['public', 'brackets', 'overview', eventSlug],
    queryFn: async () => {
      try {
        return await apiGet<PublicBracketsOverviewResponse>(
          `/api/public/brackets/overview?eventSlug=${encodeURIComponent(eventSlug!)}`,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(eventSlug),
  });
}

export function usePublicBracketCategory(input: {
  eventSlug: string | null;
  eventWeightCategoryId: string | null;
}) {
  return useQuery({
    queryKey: [
      'public',
      'brackets',
      'category',
      input.eventSlug,
      input.eventWeightCategoryId,
    ],
    queryFn: async () => {
      try {
        return await apiGet<PublicBracketCategoryDetailsResponse>(
          `/api/public/brackets/category?eventSlug=${encodeURIComponent(input.eventSlug!)}&eventWeightCategoryId=${encodeURIComponent(input.eventWeightCategoryId!)}`,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(input.eventSlug && input.eventWeightCategoryId),
  });
}
