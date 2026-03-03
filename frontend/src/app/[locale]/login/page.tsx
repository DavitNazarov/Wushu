'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { TopbarToggles } from '@/components/layout/TopbarToggles';

type UserRole = 'admin' | 'coach' | 'athlete';

function getRedirectForRole(role: UserRole, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  if (role === 'coach') return `/${locale}/coach`;
  if (role === 'athlete') return `/${locale}/athlete`;
  return `/${locale}/admin`;
}

export default function LoginPage() {
  const tApp = useTranslations('app');
  const tAuth = useTranslations('auth');
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = (await response.json()) as { ok?: boolean; role?: UserRole; error?: string };

      if (!response.ok) {
        if (data.error === 'USER_DISABLED') {
          setError('Account is disabled. Contact support.');
        } else if (data.error === 'NO_ROLE') {
          setError('No role assigned. Contact support.');
        } else {
          setError(tAuth('errorInvalid'));
        }
        setSubmitting(false);
        return;
      }

      const redirectTo =
        searchParams.get('next') || getRedirectForRole(data.role ?? 'admin', locale);
      router.push(redirectTo);
    } catch {
      setError(tAuth('errorGeneric'));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-6 py-4">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-[var(--color-text)] hover:opacity-90"
          >
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {tApp('badge')}
            </span>
            <span className="text-sm font-medium">{tApp('subtitle')}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/events`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('viewEvents')}
            </Link>
            <TopbarToggles />
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-6 space-y-2 text-center">
            <div className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {tApp('badge')}
            </div>
            <h1 className="text-lg font-semibold text-[var(--color-text)]">{tApp('title')}</h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">{tAuth('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[var(--color-text)]"
              >
                {tAuth('emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[var(--color-text)]"
              >
                {tAuth('passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 w-full items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? tAuth('submitSubmitting') : tAuth('submitIdle')}
            </button>

            <p className="text-center">
              <Link
                href="#"
                className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                {tAuth('forgotPassword')}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
