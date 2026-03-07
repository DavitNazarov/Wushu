'use client';

import { useState, useEffect } from 'react';

export type UserRole = 'admin' | 'coach' | 'athlete';

type AuthState =
  | { role: UserRole; isLoading: false }
  | { role: null; isLoading: false }
  | { role: null; isLoading: true };

/**
 * Fetches current user role for public header. Does NOT redirect on 401.
 */
export function useAuthRole(): AuthState {
  const [state, setState] = useState<AuthState>({ role: null, isLoading: true });

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (cancelled) return;

        if (res.status === 401 || !res.ok) {
          setState({ role: null, isLoading: false });
          return;
        }

        const data = (await res.json()) as { role?: string | null };
        const role = data.role as UserRole | undefined;
        if (role && (role === 'admin' || role === 'coach' || role === 'athlete')) {
          setState({ role, isLoading: false });
        } else {
          setState({ role: null, isLoading: false });
        }
      } catch {
        if (!cancelled) setState({ role: null, isLoading: false });
      }
    }

    void fetchRole();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
