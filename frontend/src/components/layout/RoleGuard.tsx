import { redirect } from 'next/navigation';
import {
  getAuthContext,
  getAuthRedirectUrl,
  canAccessAdmin,
  canAccessCoach,
  canAccessAthlete,
} from '@/services/permissions';

type GuardType = 'admin' | 'coach' | 'athlete';

export async function requireRole(
  guardType: GuardType,
  locale: string,
): Promise<{ userId: string; organisationId: string; role: string; clubId?: string | null }> {
  const auth = await getAuthContext();

  if (!auth.userId || !auth.organisationId) {
    redirect(getAuthRedirectUrl(auth, locale, `/${locale}/${guardType}`));
  }

  let allowed = false;
  if (guardType === 'admin') {
    allowed = canAccessAdmin(auth.role, auth.capabilities);
  } else if (guardType === 'coach') {
    allowed = canAccessCoach(auth.role);
  } else if (guardType === 'athlete') {
    allowed = canAccessAthlete(auth.role);
  }

  if (!allowed) {
    redirect(`/${locale}/no-access`);
  }

  return {
    userId: auth.userId,
    organisationId: auth.organisationId,
    role: auth.role ?? 'athlete',
    clubId: 'clubId' in auth ? auth.clubId : undefined,
  };
}
