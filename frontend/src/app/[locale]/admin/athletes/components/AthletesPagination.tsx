'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PAGE_SIZE } from '../athletes.types';
import { getPaginationPages } from '../athletes.utils';

type Props = {
  page: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (p: number) => void;
};

export function AthletesPagination({ page, totalPages, totalRows, onPageChange }: Props) {
  const t = useTranslations('athletes');
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 pt-1">
      <p className="text-[12px] text-[var(--color-text-muted)]">
        {t('pagination.showing', {
          from: (page - 1) * PAGE_SIZE + 1,
          to: Math.min(page * PAGE_SIZE, totalRows),
          total: totalRows,
        })}
      </p>
      <div className="flex items-center gap-1">
        <motion.button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </motion.button>

        {getPaginationPages(page, totalPages).map((item, i) =>
          item === '…' ? (
            <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-[12px] text-[var(--color-text-muted)]">…</span>
          ) : (
            <motion.button
              key={item}
              type="button"
              onClick={() => onPageChange(item as number)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.12 }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-medium transition-colors ${
                item === page
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)]'
              }`}
            >
              {item}
            </motion.button>
          )
        )}

        <motion.button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}
