'use client';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function BracketScrollableViewport({ children }: Props) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
      <div className="overflow-x-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex min-w-max items-start gap-4">{children}</div>
      </div>
    </div>
  );
}
