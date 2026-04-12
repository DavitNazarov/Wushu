'use client';

import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function BracketScrollableViewport({ children }: Props) {
  return (
    <div className="bracket-scrollable-viewport relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="overflow-x-auto px-4 py-4 sm:px-5 sm:py-5">
        <div className="bracket-rounds flex min-w-max items-start gap-8">{children}</div>
      </div>
    </div>
  );
}
