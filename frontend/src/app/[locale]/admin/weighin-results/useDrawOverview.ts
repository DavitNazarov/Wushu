'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { DrawOverviewResponse } from '@/types/api';

export function useDrawOverview(eventId: string) {
  return useQuery({
    queryKey: ['draw-overview', eventId],
    queryFn: () => apiGet<DrawOverviewResponse>(`/api/draw/overview?eventId=${eventId}`),
    enabled: Boolean(eventId),
  });
}
