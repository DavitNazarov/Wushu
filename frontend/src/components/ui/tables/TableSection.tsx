'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { adminVariants } from '@/lib/animations/variants';

interface TableSectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  animated?: boolean;
  count?: number;
}

/**
 * Reusable table section wrapper
 * Provides consistent styling and optional animation
 * Useful for wrapping data tables with headers
 */
export function TableSection({
  title,
  subtitle,
  children,
  className = '',
  animated = true,
  count,
}: TableSectionProps) {
  const headerContent = title && (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">
        {title}
        {count !== undefined && (
          <span className="ml-2 inline-block rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-muted)]">
            ({count})
          </span>
        )}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
      )}
    </div>
  );

  if (!animated) {
    return (
      <div className={className}>
        {headerContent}
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={adminVariants.slideUp}
    >
      {headerContent}
      <motion.div
        variants={adminVariants.staggerContainer}
        initial="initial"
        animate="animate"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * Table row that animates in sequence within a stagger container
 */
export function AnimatedTableRow({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.tr
      variants={adminVariants.staggerItem}
      className={`cursor-pointer transition ${className}`}
      onClick={onClick}
      whileHover={{ backgroundColor: 'var(--color-surface-alt)' }}
    >
      {children}
    </motion.tr>
  );
}
