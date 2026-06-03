'use client';

/**
 * TopbarActions — right-side header cluster for AdminShell + CoachShell.
 *
 * Mirrors the AppSidebar's liquid-hover pattern: shared layoutId makes the
 * hover highlight glide between items (spring 350/35). Items render their
 * own content above an absolutely-positioned motion backdrop.
 *
 * Items: Home (public site) · Public-nav drawer (Menu) · Language pill · Theme toggle.
 */

import { ReactNode, useId, useState } from 'react';
import {
  Home,
  Sun,
  Moon,
  Menu,
  Users,
  Newspaper,
  CalendarDays,
  Info,
  BookOpen,
  Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { MobileDrawer } from './MobileDrawer';
import { LanguageToggle } from './LanguageToggle';
import { useAuthRole } from '@/hooks/useAuthRole';

const PRIMARY_LINKS = [
  { href: '/clubs', key: 'clubs', exact: true, icon: Users },
  { href: '/news', key: 'news', exact: true, icon: Newspaper },
  { href: '/events', key: 'viewEvents', exact: false, icon: CalendarDays },
] as const;

const MORE_LINKS = [
  { href: '/about', key: 'about', icon: Info, exact: false as boolean },
  { href: '/rules', key: 'rules', icon: BookOpen, exact: false as boolean },
  { href: '/contact', key: 'contact', icon: Mail, exact: true as boolean },
];

function ActionWrap({
  itemKey,
  hoveredKey,
  layoutId,
  onHoverStart,
  onHoverEnd,
  children,
}: {
  itemKey: string;
  hoveredKey: string | null;
  layoutId: string;
  onHoverStart: (key: string) => void;
  onHoverEnd: () => void;
  children: ReactNode;
}) {
  const isHovered = hoveredKey === itemKey;
  return (
    <div
      className="relative"
      onMouseEnter={() => onHoverStart(itemKey)}
      onMouseLeave={onHoverEnd}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            layoutId={`${layoutId}-hover`}
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-input)] bg-[var(--color-surface-alt)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            style={{ zIndex: 0 }}
          />
        )}
      </AnimatePresence>
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Drawer nav item with liquid hover + active pill ──────────────────── */

function DrawerNavItem({
  href,
  exact,
  itemKey,
  hoveredKey,
  layoutId,
  onHoverStart,
  onHoverEnd,
  onClick,
  children,
}: {
  href: string;
  exact?: boolean;
  itemKey: string;
  hoveredKey: string | null;
  layoutId: string;
  onHoverStart: (key: string) => void;
  onHoverEnd: () => void;
  onClick?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || (href !== '/' && (pathname ?? '').startsWith(href + '/'));
  const isHovered = hoveredKey === itemKey;

  return (
    <div className="relative">
      <AnimatePresence>
        {isHovered && !isActive && (
          <motion.div
            layoutId={`${layoutId}-hover`}
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-input)] bg-[var(--color-surface-alt)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            style={{ zIndex: 0 }}
          />
        )}
      </AnimatePresence>

      {isActive && (
        <motion.div
          layoutId={`${layoutId}-active`}
          className="pointer-events-none absolute inset-0 rounded-[var(--radius-input)] bg-[var(--color-primary-subtle)]"
          transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          style={{ zIndex: 0 }}
        />
      )}

      <Link
        href={href}
        onClick={onClick}
        onMouseEnter={() => onHoverStart(itemKey)}
        onMouseLeave={onHoverEnd}
        className={`relative flex min-h-[48px] items-center gap-2.5 rounded-[var(--radius-input)] px-4 py-2 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
          isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'
        }`}
        style={{ zIndex: 1 }}
      >
        {children}
      </Link>
    </div>
  );
}

export function TopbarActions() {
  const tNav = useTranslations('nav');
  const tAdmin = useTranslations('admin');
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { role, isLoading } = useAuthRole();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [drawerHoveredKey, setDrawerHoveredKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const layoutId = useId();
  const drawerLayoutId = useId();

  const signInHref = '/login';
  const dashboardHref =
    role === 'admin'
      ? '/admin'
      : role === 'coach'
        ? '/coach'
        : role === 'athlete'
          ? '/athlete'
          : signInHref;
  const signInLabel =
    role === 'admin'
      ? tPublic('adminDashboard')
      : role === 'coach'
        ? tPublic('coachDashboard')
        : role === 'athlete'
          ? tPublic('athleteProfile')
          : tPublic('adminSignIn');

  const setHovered = (key: string) => setHoveredKey(key);
  const clearHovered = () => setHoveredKey(null);

  return (
    <div className="flex items-center gap-1">
      {/* Home → public site */}
      <ActionWrap
        itemKey="home"
        hoveredKey={hoveredKey}
        layoutId={layoutId}
        onHoverStart={setHovered}
        onHoverEnd={clearHovered}
      >
        <Link
          href="/"
          title={tNav('home')}
          aria-label={tNav('home')}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <Home className="h-4 w-4" strokeWidth={2} />
        </Link>
      </ActionWrap>

      {/* Public-nav drawer trigger */}
      <ActionWrap
        itemKey="menu"
        hoveredKey={hoveredKey}
        layoutId={layoutId}
        onHoverStart={setHovered}
        onHoverEnd={clearHovered}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={tPublic('openMenu')}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <Menu className="h-4 w-4" strokeWidth={2} />
        </button>
      </ActionWrap>


      {/* Theme toggle */}
      <ActionWrap
        itemKey="theme"
        hoveredKey={hoveredKey}
        layoutId={layoutId}
        onHoverStart={setHovered}
        onHoverEnd={clearHovered}
      >
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? tAdmin('theme.light') : tAdmin('theme.dark')}
          aria-label={theme === 'dark' ? tAdmin('theme.light') : tAdmin('theme.dark')}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Moon className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </ActionWrap>

       {/* Language toggle (kept as a pill — own active styling) */}
      <LanguageToggle />

      
      {/* Public-nav drawer (rendered alongside; opened by the Menu button above) */}
      <MobileDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={tPublic('menu')}
        side="right"
        overlayTop="top-14"
        hideOnDesktop={false}
      >
        <nav className="flex flex-col gap-0.5 px-3 py-4" aria-label="Main">
          {PRIMARY_LINKS.map(({ href, key, exact, icon: Icon }) => (
            <DrawerNavItem
              key={href}
              href={href}
              exact={exact}
              itemKey={key}
              hoveredKey={drawerHoveredKey}
              layoutId={drawerLayoutId}
              onHoverStart={setDrawerHoveredKey}
              onHoverEnd={() => setDrawerHoveredKey(null)}
              onClick={() => setMenuOpen(false)}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              {tPublic(key)}
            </DrawerNavItem>
          ))}

          <div className="my-3 h-px bg-[var(--color-border)]" />

          {MORE_LINKS.map(({ href, key, icon: Icon, exact }) => (
            <DrawerNavItem
              key={href}
              href={href}
              exact={exact}
              itemKey={key}
              hoveredKey={drawerHoveredKey}
              layoutId={drawerLayoutId}
              onHoverStart={setDrawerHoveredKey}
              onHoverEnd={() => setDrawerHoveredKey(null)}
              onClick={() => setMenuOpen(false)}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              {tPublic(key)}
            </DrawerNavItem>
          ))}
        </nav>

        <div className="flex flex-col gap-4 border-t-2 border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {tPublic('language')}
            </span>
            <LanguageToggle />
          </div>
          <Link
            href={isLoading ? signInHref : dashboardHref}
            onClick={() => setMenuOpen(false)}
            className="flex min-h-[48px] items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] text-base font-bold text-white transition-colors duration-150 ease-out hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
          >
            {isLoading ? tPublic('adminSignIn') : signInLabel}
          </Link>
        </div>
      </MobileDrawer>
    </div>
  );
}
