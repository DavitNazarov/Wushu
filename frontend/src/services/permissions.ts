import { cookies } from 'next/headers';
import { getApiUrl } from '@/lib/api';
import type { CapabilityCode, UserRole } from '@/domain/auth/capabilities';

const AUTH_COOKIE_NAME = 'gw_auth';

export type AuthContext =
  | {
      userId: string;
      organisationId: string;
      role: UserRole;
      capabilities: string[];
    }
  | {
      userId: null;
      organisationId: null;
      role: null;
      capabilities: [];
    };

export async function getAuthContext(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return { userId: null, organisationId: null, role: null, capabilities: [] };
  }

  const res = await fetch(getApiUrl('/api/auth/me'), {
    headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return { userId: null, organisationId: null, role: null, capabilities: [] };
  }

  const data = (await res.json()) as {
    userId: string | null;
    organisationId: string | null;
    role: UserRole | null;
    capabilities: string[];
  };

  if (!data.userId || !data.organisationId) {
    return { userId: null, organisationId: null, role: null, capabilities: [] };
  }

  return {
    userId: data.userId,
    organisationId: data.organisationId,
    role: data.role ?? 'athlete',
    capabilities: data.capabilities ?? [],
  };
}

export function canAccessAdmin(role: UserRole | null, capabilities: string[]): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return capabilities.includes('events:manage') || capabilities.includes('CAN_MANAGE_EVENT');
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

