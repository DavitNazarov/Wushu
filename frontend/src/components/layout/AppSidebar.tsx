'use client';

/**
 * AppSidebar — unified animated sidebar used by both AdminShell and CoachShell.
 *
 * Animations (from animate-ui sidebar):
 *  • Liquid hover highlight  — layoutId "sidebar-hover" glides between items (spring 350/35)
 *  • Active pill             — layoutId "sidebar-active" marks the current route
 *  • Collapse/expand         — motion.div animates width + opacity of labels
 *  • Mobile drawer           — AnimatePresence + slide-in from left (spring 280/30)
 *  • Section stagger         — items fade+slide in on mount
 */

import React, { useState, ReactNode, useId } from 'react';
import Link from 'next/link';
import { ChevronLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type SidebarNavItem = {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick?: () => void;
};

export type SidebarNavSection = {
  /** undefined = no label (coach single-section pattern) */
  label?: string;
  items: SidebarNavItem[];
};

export type AppSidebarProps = {
  /** Short badge text e.g. "GEO WUSHU" */
  badge: string;
  /** Small subtitle below badge */
  subtitle: string;
  /** Nav sections to render */
  sections: SidebarNavSection[];
  /** Slot below nav, above logout (event selector, shortcuts, etc.) */
  extraContent?: ReactNode;
  /** Footer slot (logout button) */
  footer: ReactNode;
  /** Footer slot in icon-only mode (collapsed admin) */
  footerIconOnly?: ReactNode;
  /** Admin-only: whether sidebar is collapsed to icon-only */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Mobile drawer open state */
  mobileOpen: boolean;
  onMobileClose: () => void;
};

/* ─── Liquid-highlight Nav Item ─────────────────────────────────────────── */

function NavItem({
  item,
  collapsed,
  hoveredKey,
  layoutId,
  onHoverStart,
  onHoverEnd,
}: {
  item: SidebarNavItem;
  collapsed: boolean;
  hoveredKey: string | null;
  layoutId: string;
  onHoverStart: (key: string) => void;
  onHoverEnd: () => void;
}) {
  const Icon = item.icon;
  const isHovered = hoveredKey === item.key;

  return (
    <li className="relative list-none">
      {/* Liquid hover highlight — animate-ui sidebar pattern */}
      <AnimatePresence>
        {isHovered && !item.active && (
          <motion.div
            layoutId={`${layoutId}-hover`}
            className="absolute inset-0 rounded-lg bg-[var(--color-surface-alt)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            style={{ zIndex: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Active pill — shared layout, glides between routes */}
      {item.active && (
        <motion.div
          layoutId={`${layoutId}-active`}
          className="absolute inset-0 rounded-lg bg-[var(--color-primary-subtle)]"
          transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          style={{ zIndex: 0 }}
        />
      )}

      <Link
        href={item.href}
        onClick={item.onClick}
        title={collapsed ? item.label : undefined}
        onMouseEnter={() => onHoverStart(item.key)}
        onMouseLeave={onHoverEnd}
        className={`relative z-10 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
          item.active
            ? 'text-[var(--color-primary)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        } ${collapsed ? 'justify-center' : ''}`}
        style={{ zIndex: 1 }}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />

        {/* Animated label — fades + slides out when collapsed */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              className="truncate"
              initial={{ opacity: 0, x: -6, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: -6, width: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    </li>
  );
}

/* ─── Sidebar inner content (shared between desktop + mobile) ─────────────── */

function SidebarContent({
  badge,
  subtitle,
  sections,
  extraContent,
  footer,
  footerIconOnly,
  collapsed,
  layoutId,
}: {
  badge: string;
  subtitle: string;
  sections: SidebarNavSection[];
  extraContent?: ReactNode;
  footer: ReactNode;
  footerIconOnly?: ReactNode;
  collapsed: boolean;
  layoutId: string;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <>
      {/* Badge / brand */}
      <div className={`px-4 pb-2 pt-5 ${collapsed ? 'text-center' : ''}`}>
        <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
          {collapsed ? badge.slice(0, 2) : badge}
        </span>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="mt-1 overflow-hidden text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)]"
            >
              {subtitle}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-2">
        {sections.map((section, si) => (
          <motion.div
            key={section.label ?? `section-${si}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.05, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Section label */}
            <AnimatePresence initial={false}>
              {!collapsed && section.label && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="mb-1.5 overflow-hidden px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
                >
                  {section.label}
                </motion.div>
              )}
            </AnimatePresence>

            <ul className="flex flex-col gap-0.5 p-0 m-0">
              {section.items.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  collapsed={collapsed}
                  hoveredKey={hoveredKey}
                  layoutId={layoutId}
                  onHoverStart={setHoveredKey}
                  onHoverEnd={() => setHoveredKey(null)}
                />
              ))}
            </ul>
          </motion.div>
        ))}

        {/* Extra content slot (admin event selector / shortcuts) */}
        {!collapsed && extraContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: sections.length * 0.05 + 0.05, duration: 0.25 }}
          >
            {extraContent}
          </motion.div>
        )}
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-[var(--color-border)] px-3 py-3 ${collapsed ? 'flex justify-center' : ''}`}
      >
        {collapsed && footerIconOnly ? footerIconOnly : footer}
      </div>
    </>
  );
}

/* ─── Main export ────────────────────────────────────────────────────────── */

export function AppSidebar({
  badge,
  subtitle,
  sections,
  extraContent,
  footer,
  footerIconOnly,
  collapsed = false,
  onCollapsedChange,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  // Stable layoutId so hover/active pills don't conflict between desktop and mobile
  const desktopId = useId();
  const mobileId = useId();

  const sharedProps = { badge, subtitle, sections, extraContent, footer, footerIconOnly };

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <motion.aside
        className="hidden flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex"
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}
        animate={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      >
        <SidebarContent {...sharedProps} collapsed={collapsed} layoutId={desktopId} />

        {/* Collapse toggle */}
        {onCollapsedChange && (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex h-10 items-center justify-center border-t border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
          >
            <motion.span
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{ display: 'inline-flex' }}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </motion.span>
          </button>
        )}
      </motion.aside>

      {/* ── Mobile overlay + drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onMobileClose}
            />

            {/* Slide-in drawer */}
            <motion.div
              className="fixed left-0 top-0 z-50 flex h-full w-[var(--sidebar-width)] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl md:hidden"
              initial={{ x: '-100%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={onMobileClose}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>

              <SidebarContent {...sharedProps} collapsed={false} layoutId={mobileId} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
