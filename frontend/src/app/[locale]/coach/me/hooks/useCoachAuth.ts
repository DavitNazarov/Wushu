'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import type { AuthContext } from '../me.types';

export function useCoachAuth(locale: string) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const ctx = await apiGet<AuthContext>('/api/auth/me');
        if (cancelled) return;
        setAuth(ctx);
        if (!ctx.userId || !ctx.organisationId) {
          router.push(`/${locale}/login?next=/${locale}/coach/me`);
        }
      } catch {
        if (!cancelled) router.push(`/${locale}/login?next=/${locale}/coach/me`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [router, locale]);

  return { auth, loading };
}
