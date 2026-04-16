import { cookies } from 'next/headers';
import { getServerApiUrl } from '@/lib/api';
import type { CapabilityCode, UserRole } from '@/domain/auth/capabilities';

const AUTH_COOKIE_NAME = 'gw_auth';

export type AuthContext =
  | {
      userId: string;
      organisationId: string;
      role: UserRole;
      capabilities: string[];
      clubId?: string | null;
      displayName?: string;
      clubName?: string | null;
      organisationName?: string | null;
    }
  | {
      userId: null;
      organisationId: null;
      role: null;
      capabilities: [];
      clubId?: null;
      needsRefresh?: boolean;
      blocked?: boolean;
    };

export async function getAuthContext(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  const refreshToken = cookieStore.get('gw_refresh')?.value;
  if (!token && !refreshToken) {
    return { userId: null, organisationId: null, role: null, capabilities: [] };
  }

  // Only access token works for /me; if we have only refresh, try refresh flow
  if (!token) {
    return { userId: null, organisationId: null, role: null, capabilities: [], needsRefresh: true };
  }

  const fetchMe = async () =>
    fetch(await getServerApiUrl('/api/auth/me'), {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
      cache: 'no-store',
    });

  let res: Response;
  try {
    res = await fetchMe();
  } catch {
    // API unreachable (ECONNREFUSED, network error) → treat as unauthenticated
    return { userId: null, organisationId: null, role: null, capabilities: [] };
  }

  // 401 = expired access token → try refresh via redirect
  if (res.status === 401) {
    return { userId: null, organisationId: null, role: null, capabilities: [], needsRefresh: true };
  }
  if (res.status === 403) {
    return { userId: null, organisationId: null, role: null, capabilities: [], blocked: true };
  }

  // 429 = throttled — never treat this as "logged out". Return a needsRefresh
  // signal so the page can retry rather than bouncing the user to /login (which
  // would cause an infinite redirect loop because the cookie is still valid).
  if (res.status === 429) {
    return { userId: null, organisationId: null, role: null, capabilities: [], needsRefresh: true };
  }

  // Transient errors: retry once before treating as logout
  if (!res.ok) {
    try {
      res = await fetchMe();
    } catch {
      return { userId: null, organisationId: null, role: null, capabilities: [] };
    }
    if (res.status === 429) {
      return { userId: null, organisationId: null, role: null, capabilities: [], needsRefresh: true };
    }
    if (!res.ok) {
      return { userId: null, organisationId: null, role: null, capabilities: [] };
    }
  }

  const data = (await res.json()) as {
    userId: string | null;
    organisationId: string | null;
    role: UserRole | null;
    capabilities: string[];
    clubId?: string | null;
    displayName?: string;
    clubName?: string | null;
    organisationName?: string | null;
  };

  if (!data.userId || !data.organisationId) {
    return { userId: null, organisationId: null, role: null, capabilities: [] };
  }

  return {
    userId: data.userId,
    organisationId: data.organisationId,
    role: data.role ?? 'athlete',
    capabilities: data.capabilities ?? [],
    clubId: data.clubId ?? null,
    displayName: data.displayName,
    clubName: data.clubName,
    organisationName: data.organisationName,
  };
}

export function getAuthRedirectUrl(
  auth: AuthContext,
  locale: string,
  nextPath: string,
): string {
  if ('needsRefresh' in auth && auth.needsRefresh) {
    return `/${locale}/auth/refresh?next=${encodeURIComponent(nextPath)}`;
  }
  if ('blocked' in auth && auth.blocked) {
    return `/${locale}/no-access`;
  }
  return `/${locale}/login?next=${encodeURIComponent(nextPath)}`;
}

export function canAccessAdmin(role: UserRole | null, capabilities: string[]): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return capabilities.includes('EVENTS_MANAGE');
}

export function canAccessCoach(role: UserRole | null): boolean {
  return role === 'admin' || role === 'coach';
}

export function canAccessAthlete(role: UserRole | null): boolean {
  return role === 'admin' || role === 'coach' || role === 'athlete';
}

export async function requireCapability(
  required: CapabilityCode,
): Promise<{ userId: string; organisationId: string }> {
  const auth = await getAuthContext();

  if (!auth.userId || !auth.organisationId) {
    throw new Error('UNAUTHENTICATED');
  }

  if (!auth.capabilities.includes(required)) {
    throw new Error('FORBIDDEN');
  }

  return {
    userId: auth.userId,
    organisationId: auth.organisationId,
  };
}
