'use client';

import { useState, useEffect } from 'react';

type UserRole = 'admin' | 'coach' | 'athlete';

type AuthState =
  | { role: UserRole; capabilities: string[]; isLoading: false }
  | { role: null; capabilities: string[]; isLoading: false }
  | { role: null; capabilities: string[]; isLoading: true };

/**
 * Fetches current user role + capabilities for public pages. Does NOT redirect
 * on 401 (unlike apiGet's refresh flow) — anonymous viewers simply get
 * { role: null, capabilities: [] }, which is why public components must use
 * THIS hook and never useCurrentUser/apiGet for auth probing.
 */
export function useAuthRole(): AuthState {
  const [state, setState] = useState<AuthState>({
    role: null,
    capabilities: [],
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (cancelled) return;

        if (res.status === 401 || !res.ok) {
          setState({ role: null, capabilities: [], isLoading: false });
          return;
        }

        const data = (await res.json()) as {
          role?: string | null;
          capabilities?: string[];
        };
        const role = data.role as UserRole | undefined;
        const capabilities = Array.isArray(data.capabilities)
          ? data.capabilities
          : [];
        if (role && (role === 'admin' || role === 'coach' || role === 'athlete')) {
          setState({ role, capabilities, isLoading: false });
        } else {
          setState({ role: null, capabilities: [], isLoading: false });
        }
      } catch {
        if (!cancelled)
          setState({ role: null, capabilities: [], isLoading: false });
      }
    }

    void fetchRole();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * True when the logged-in user can hold a live socket. The socket gateway
 * requires LIVE_RUN at handshake — anonymous/unprivileged viewers must not
 * even attempt to connect (each rejected handshake retries forever and was
 * the C1 spectator-load risk).
 */
export function useCanUseLiveSocket(): boolean {
  const auth = useAuthRole();
  return auth.capabilities.includes('LIVE_RUN');
}
