'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export interface CurrentUser {
  userId: string | null;
  role: string | null;
  clubId: string | null;
  nationality: string | null;
  displayName: string | null;
  clubName: string | null;
  organisationName: string | null;
}

/**
 * Fetches the current authenticated user's profile including nationality.
 * Used in authenticated client pages that need user context.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiGet<CurrentUser>('/api/auth/me'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/** Returns true if the current user is a Georgian user (nationality === 'GE') */
export function useIsGeorgian(nationality: string | null | undefined): boolean {
  return nationality === 'GE';
}
