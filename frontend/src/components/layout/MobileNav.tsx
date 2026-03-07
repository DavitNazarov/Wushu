'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NavItem } from './NavItem';
import { Link } from '@/i18n/navigation';
import { useAuthRole } from '@/hooks/useAuthRole';
import { LanguageToggle } from './LanguageToggle';
import { MobileDrawer } from './MobileDrawer';

const PRIMARY_LINKS = [
  { href: '/clubs', key: 'clubs', exact: true },
  { href: '/news', key: 'news', exact: true },
  { href: '/events', key: 'viewEvents', exact: false },
] as const;

const MORE_LINKS = [
  { href: '/about', key: 'about' },
  { href: '/rules', key: 'rules' },
  { href: '/contact', key: 'contact', exact: true },
] as const;

type MobileNavProps = {
  /** For use in dashboard header - different overlay offset, works on desktop */
  variant?: 'public' | 'dashboard';
};

export function MobileNav({ variant = 'public' }: MobileNavProps) {
  const t = useTranslations('public');
  const [open, setOpen] = useState(false);
  const { role, isLoading } = useAuthRole();

  const isDashboard = variant === 'dashboard';
  const overlayTop = isDashboard ? 'top-14' : 'top-16';

  const signInHref = '/login';
  const dashboardHref =
    role === 'admin' ? '/admin' : role === 'coach' ? '/coach' : role === 'athlete' ? '/athlete' : signInHref;
  const signInLabel =
    role === 'admin'
      ? t('adminDashboard')
      : role === 'coach'
        ? t('coachDashboard')
        : role === 'athlete'
          ? t('athleteProfile')
          : t('adminSignIn');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('openMenu')}
        className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text)] transition-colors duration-150 ease-out hover:bg-[var(--color-primary-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${!isDashboard ? 'md:hidden' : ''}`}
      >
        <Menu className="h-5 w-5" />
      </button>

      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={t('menu')}
        side="right"
        overlayTop={overlayTop}
        hideOnDesktop={!isDashboard}
      >
        <nav className="flex flex-col gap-0.5 px-3 py-4" aria-label="Main">
          {PRIMARY_LINKS.map(({ href, key, exact }) => (
            <NavItem key={href} href={href} exact={exact} size="touch">
              {t(key)}
            </NavItem>
          ))}
          <div className="my-3 h-px bg-[var(--color-border)]" />
          {MORE_LINKS.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex min-h-[48px] items-center rounded-[var(--radius-input)] px-4 text-[15px] font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary-subtle)] active:bg-[var(--color-primary-subtle)]"
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-4 border-t-2 border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('language')}
            </span>
            <LanguageToggle />
          </div>
          <Link
            href={isLoading ? signInHref : dashboardHref}
            onClick={() => setOpen(false)}
            className="flex min-h-[48px] items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] text-base font-bold text-white transition-colors duration-150 ease-out hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          >
            {isLoading ? t('adminSignIn') : signInLabel}
          </Link>
        </div>
      </MobileDrawer>
    </>
  );
}
