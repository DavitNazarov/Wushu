'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/primitives/button';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import { PasswordField } from './PasswordField';

type UserRole = 'admin' | 'coach' | 'athlete';

function getRedirectForRole(role: UserRole, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  if (role === 'coach') return `/${locale}/coach`;
  if (role === 'athlete') return `/${locale}/athlete`;
  return `/${locale}/admin`;
}

function getLoginErrorMessage(errorCode: string | undefined, tAuth: ReturnType<typeof useTranslations<'auth'>>) {
  if (errorCode === 'USER_DISABLED') return tAuth('errorUserDisabled');
  if (errorCode === 'NO_ROLE') return tAuth('errorNoRoleAssigned');
  return tAuth('errorInvalid');
}

export function LoginForm() {
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        setError(getLoginErrorMessage(data.error, tAuth));
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{tAuth('emailLabel')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <PasswordField
        label={tAuth('passwordLabel')}
        showPassword={showPassword}
        value={password}
        onChange={setPassword}
        onToggleVisibility={() => setShowPassword((current) => !current)}
        showPasswordLabel={tAuth('showPassword')}
        hidePasswordLabel={tAuth('hidePassword')}
      />

      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? tAuth('submitSubmitting') : tAuth('submitIdle')}
      </Button>

      <p className="text-center">
        <Link
          href="#"
          className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {tAuth('forgotPassword')}
        </Link>
      </p>
    </form>
  );
}
