import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { BracketsOverviewResponse } from '@/types/api';

export function useBracketsOverview(eventId: string) {
  return useQuery({
    queryKey: ['brackets-overview', eventId],
    queryFn: () =>
      apiGet<BracketsOverviewResponse>(`/api/brackets/overview?eventId=${eventId}`),
    enabled: Boolean(eventId),
  });
}
