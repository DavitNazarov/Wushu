'use client';

import { LogOut } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type LogoutButtonProps = {
  /** When true, show only the icon (e.g. in collapsed sidebar) */
  iconOnly?: boolean;
};

export function LogoutButton({ iconOnly = false }: LogoutButtonProps) {
  const t = useTranslations('auth');
  const locale = useLocale();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = `/${locale}/login`;
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`flex items-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] ${
        iconOnly ? 'h-10 w-10 justify-center p-0' : 'gap-2 px-3 py-2'
      }`}
      title={t('logout')}
    >
      <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
      {!iconOnly && <span className="hidden sm:inline">{t('logout')}</span>}
    </button>
  );
}
