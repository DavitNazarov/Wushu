'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { DesktopNav } from './DesktopNav';
import { MobileNav } from './MobileNav';
import { LanguageToggle } from './LanguageToggle';
import { useAuthRole } from '@/hooks/useAuthRole';

const SCROLL_THRESHOLD = 12;

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

  const fullName = tApp('title').replace(/\s+/g, ' ').trim();

  return (
    <header
      className={`
        sticky top-0 z-40 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out
        ${
          scrolled
            ? 'border-b border-[var(--color-border)]/70 bg-[var(--color-surface)]/85 shadow-[var(--shadow-soft)] backdrop-blur-xl'
            : 'border-b border-transparent bg-[var(--color-surface)]/45 backdrop-blur-md'
        }
      `}
    >
      <div
        className={`
          mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 transition-[height] duration-300 ease-out md:px-6
          ${scrolled ? 'h-14 md:h-16' : 'h-16 md:h-20'}
        `}
      >
        {/* Brand lockup */}
        <Link
          href="/"
          aria-label={fullName}
          className="group flex shrink-0 items-center gap-3 rounded-[var(--radius-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2"
        >
          <span className="relative grid h-9 w-9 place-items-center">
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 h-full w-full transition-transform duration-500 ease-out group-hover:rotate-45"
              aria-hidden
            >
              <polygon
                points="30,6 70,6 94,30 94,70 70,94 30,94 6,70 6,30"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="5"
                strokeOpacity="0.85"
              />
              <polygon
                points="38,20 62,20 80,38 80,62 62,80 38,80 20,62 20,38"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="3"
                strokeOpacity="0.3"
              />
            </svg>
            <span className="text-[12px] font-black tracking-tighter text-[var(--color-primary)]">
              {tApp('badge').slice(0, 2)}
            </span>
          </span>

          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-black tracking-tight text-[var(--color-text)]">
              {tApp('badge')}
            </span>
            <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] lg:block">
              {fullName}
            </span>
          </span>
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden md:block">
            <LanguageToggle />
          </div>
          <Link
            href={isLoading ? signInHref : dashboardHref}
            className="group relative hidden shrink-0 items-center gap-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_28px_-10px_var(--color-primary)] transition-[transform,background-color] duration-200 ease-out hover:scale-[1.03] hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50 focus-visible:ring-offset-2 md:inline-flex"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">{isLoading ? tPublic('adminSignIn') : signInLabel}</span>
            <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
