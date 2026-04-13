'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/primitives/button';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import { PasswordField } from './PasswordField';

const fieldVariant = {
  hidden: { opacity: 0, y: 10, filter: 'blur(3px)' },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: i * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  }),
};

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
    <form onSubmit={handleSubmit} className="space-y-5">
      <motion.div custom={0} variants={fieldVariant} initial="hidden" animate="visible" className="space-y-1.5">
        <Label htmlFor="email" className="text-[13px] font-medium text-[var(--color-text-muted)]">
          {tAuth('emailLabel')}
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded-lg border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 text-[14px] placeholder:text-[var(--color-text-muted)]/50 focus-visible:border-[var(--color-primary)] focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/30"
        />
      </motion.div>

      <motion.div custom={1} variants={fieldVariant} initial="hidden" animate="visible">
        <PasswordField
          label={tAuth('passwordLabel')}
          showPassword={showPassword}
          value={password}
          onChange={setPassword}
          onToggleVisibility={() => setShowPassword((current) => !current)}
          showPasswordLabel={tAuth('showPassword')}
          hidePasswordLabel={tAuth('hidePassword')}
        />
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/6 px-3.5 py-2.5"
          >
            <svg className="mt-px h-4 w-4 shrink-0 text-[var(--color-danger)]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <p className="text-[13px] text-[var(--color-danger)]">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={submitting}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className="relative w-full overflow-hidden rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {tAuth('submitSubmitting')}
          </span>
        ) : (
          tAuth('submitIdle')
        )}
      </motion.button>

      <p className="text-center">
        <Link
          href="#"
          className="text-[12px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          {tAuth('forgotPassword')}
        </Link>
      </p>
    </form>
  );
}
