'use client';

import type { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function EventFormSection({
  eyebrow,
  title,
  description,
  children,
}: Props) {
  return (
    <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <div className="mb-4">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="mt-1 text-[16px] font-semibold text-[var(--color-text)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
