'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/primitives/button';
import { generatePageNumbers, isPageNumber } from '@/lib/pagination';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  showArrows?: boolean;
  className?: string;
}

/**
 * Pagination component with page number buttons
 * Shows: [<] [1] [2] [3] ... [n] [>]
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  showArrows = true,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = generatePageNumbers(currentPage, totalPages, maxVisiblePages);
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <motion.div
      className={`flex items-center justify-center gap-1 sm:gap-2 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Previous button */}
      {showArrows && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPrevious}
          className="h-9 w-9 p-0"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Page numbers */}
      {pages.map((page, index) => {
        if (!isPageNumber(page)) {
          return (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-[var(--color-text-muted)]"
            >
              ...
            </span>
          );
        }

        const isActive = page === currentPage;

        return (
          <motion.button
            key={page}
            onClick={() => onPageChange(page)}
            className={`h-9 w-9 rounded-[var(--radius-input)] text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]'
            }`}
            whileHover={!isActive ? { scale: 1.05 } : undefined}
            whileTap={{ scale: 0.95 }}
          >
            {page}
          </motion.button>
        );
      })}

      {/* Next button */}
      {showArrows && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNext}
          className="h-9 w-9 p-0"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
}

/**
 * Simple pagination info text
 * Shows: "Page X of Y"
 */
export function PaginationInfo({
  currentPage,
  totalPages,
  className = '',
}: {
  currentPage: number;
  totalPages: number;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <p className={`text-sm text-[var(--color-text-muted)] ${className}`}>
      Page {currentPage} of {totalPages}
    </p>
  );
}
