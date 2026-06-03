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
      nationality?: string | null;
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

  // 429 = throttled — the JWT is still valid, just rate-limited (all SSR
  // requests come from the same IP). Do NOT return needsRefresh here — that
  // triggers POST /refresh which can create duplicate tokens and cascade into
  // an infinite redirect loop. The real fix is @SkipThrottle on /me; this
  // defensive fallback avoids the loop if throttling ever fires anyway.
  if (res.status === 429) {
    return { userId: null, organisationId: null, role: null, capabilities: [] };
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
    nationality?: string | null;
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
    nationality: data.nationality ?? null,
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
  // We only reach this branch from a *protected* server page, which means the
  // middleware already saw a `gw_auth` cookie and let the request through — yet
  // /me reported the user as unauthenticated (transient/network failure, or the
  // 429 fallback). Without `force=1`, the middleware's "login + cookie present →
  // dashboard" rule bounces straight back here, producing an infinite
  // login⇄dashboard redirect loop (ERR_TOO_MANY_REDIRECTS). `force=1` suppresses
  // that bounce so the user lands on (and stays on) the login page.
  return `/${locale}/login?force=1&next=${encodeURIComponent(nextPath)}`;
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
