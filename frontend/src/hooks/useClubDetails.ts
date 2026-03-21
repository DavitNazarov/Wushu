'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { ClubDetailsResponse } from '@/types/clubs';

export function useClubDetails(clubId: string) {
  return useQuery({
    queryKey: ['club-details', clubId],
    queryFn: () => apiGet<ClubDetailsResponse>(`/api/clubs/${clubId}`),
    enabled: Boolean(clubId),
  });
}
