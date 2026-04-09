'use client';

import { Link, usePathname } from '@/i18n/navigation';

type NavItemProps = {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  size?: 'default' | 'touch';
};

export function NavItem({ href, children, exact, size = 'default' }: NavItemProps) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || (href !== '/' && pathname.startsWith(href + '/'));

  return (
    <Link
      href={href}
      className={`
        flex items-center gap-2.5 rounded-[var(--radius-input)] px-4 py-2 font-medium
        ${size === 'touch' ? 'min-h-[48px] text-[15px]' : 'text-sm'}
        transition-colors duration-150 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]
        ${
          isActive
            ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
            : 'text-[var(--color-text)] hover:bg-[var(--color-primary-subtle)] hover:text-[var(--color-text)]'
        }
      `}
    >
      {children}
    </Link>
  );
}
