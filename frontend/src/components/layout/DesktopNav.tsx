'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NavItem } from './NavItem';
import { Link } from '@/i18n/navigation';

const GAP_DESKTOP = 20;

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

export function DesktopNav() {
  const t = useTranslations('public');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <nav className="hidden items-center md:flex" style={{ gap: GAP_DESKTOP }} aria-label="Main">
      {PRIMARY_LINKS.map(({ href, key, exact }) => (
        <NavItem key={href} href={href} exact={exact}>
          {t(key)}
        </NavItem>
      ))}
      <div className="relative" ref={moreRef}>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-haspopup="true"
          aria-label={t('more')}
          className={`
            flex items-center gap-1 rounded-[var(--radius-input)] px-3 py-2 text-sm font-medium
            text-[var(--color-text)] transition-colors duration-150 ease-out
            hover:bg-[var(--color-primary-subtle)]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40
          `}
        >
          {t('more')}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-150 ease-out ${moreOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <div
          className={`
            absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden
            rounded-[var(--radius-modal)] border border-[var(--color-border)]
            bg-[var(--color-surface)] py-2 shadow-[var(--shadow-card)]
            transition-all duration-[180ms] ease-out
            ${moreOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1.5 opacity-0'}
          `}
          role="menu"
        >
          {MORE_LINKS.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setMoreOpen(false)}
              className={`
                flex h-11 items-center px-3 text-sm font-medium text-[var(--color-text)]
                transition-colors duration-150 ease-out
                hover:bg-[var(--color-primary-subtle)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-inset
              `}
            >
              {t(key)}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
