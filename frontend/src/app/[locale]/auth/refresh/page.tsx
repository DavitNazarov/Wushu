'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Client-side token refresh page.
 *
 * Flow:
 *   1. Server detects access token missing/expired but refresh token present.
 *   2. Server redirects here (NOT to GET /api/auth/refresh — that would be a loop).
 *   3. This page POSTs to /api/auth/refresh (browser sends refresh cookie).
 *   4. On success: new cookies are set, router.replace(next) is called.
 *   5. On failure: redirect to /login (only once, no loop).
 *
 * The useRef guard prevents React StrictMode from firing the effect twice
 * and sending two rotation requests (the second would fail since the first
 * already revoked the old token, causing a false "failed" state).
 */
export default function AuthRefreshPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tAuth = useTranslations('auth');
  const [status, setStatus] = useState<'refreshing' | 'redirecting' | 'failed'>('refreshing');
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Guard: only run once even in React StrictMode (which mounts → unmounts → remounts)
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const nextPath = searchParams.get('next') || `/${locale}/dashboard`;

    async function doRefresh() {
      try {
        // [LOG] temporary observability
        console.debug('[auth/refresh] POSTing to /api/auth/refresh');

        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (res.ok) {
          console.debug('[auth/refresh] refresh ok — navigating to', nextPath);
          setStatus('redirecting');
          router.replace(nextPath);
          return;
        }

        console.warn('[auth/refresh] refresh failed', res.status, '— redirecting to login');
        setStatus('failed');
        router.replace(`/${locale}/login?force=1&next=${encodeURIComponent(nextPath)}`);
      } catch (err) {
        console.error('[auth/refresh] network error during refresh', err);
        setStatus('failed');
        router.replace(`/${locale}/login?force=1&next=${encodeURIComponent(nextPath)}`);
      }
    }

    void doRefresh();
  }, [locale, router, searchParams]);

  if (status === 'failed') return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <p className="text-sm text-[var(--color-text-muted)]">
        {status === 'refreshing' ? tAuth('refreshing') : tAuth('redirecting')}
      </p>
    </div>
  );
}
