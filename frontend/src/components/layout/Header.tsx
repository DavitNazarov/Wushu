'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DesktopNav } from './DesktopNav';
import { MobileNav } from './MobileNav';
import { LanguageToggle } from './LanguageToggle';
import { useAuthRole } from '@/hooks/useAuthRole';

const SCROLL_THRESHOLD = 4;

export function Header() {
  const tApp = useTranslations('app');
  const tPublic = useTranslations('public');
  const [scrolled, setScrolled] = useState(false);
  const { role, isLoading } = useAuthRole();

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const signInHref = '/login';
  const dashboardHref =
    role === 'admin' ? '/admin' : role === 'coach' ? '/coach' : role === 'athlete' ? '/athlete' : signInHref;
  const signInLabel =
    role === 'admin'
      ? tPublic('adminDashboard')
      : role === 'coach'
        ? tPublic('coachDashboard')
        : role === 'athlete'
          ? tPublic('athleteProfile')
          : tPublic('adminSignIn');

  return (
    <header
      className={`
        sticky top-0 z-30 border-b border-[var(--color-border)]/60
        bg-[var(--color-surface)]/80 backdrop-blur-md
        transition-shadow duration-150 ease-out
        ${scrolled ? 'shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : ''}
      `}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:h-[72px] md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-[var(--radius-input)] text-[var(--color-text)] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2"
        >
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {tApp('badge')}
          </span>
          {tApp('subtitle') && (
            <span className="hidden text-sm font-medium sm:inline">{tApp('subtitle')}</span>
          )}
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden md:block">
            <LanguageToggle />
          </div>
          <Link
            href={isLoading ? signInHref : dashboardHref}
            className="hidden shrink-0 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 md:inline-flex"
          >
            {isLoading ? tPublic('adminSignIn') : signInLabel}
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
