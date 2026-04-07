'use client';

import Link from 'next/link';
import type { EventRow } from '@/types/api';

type ShortcutItem = {
  key: string;
  href: string;
  label: string;
};

type Props = {
  selectedEvent: EventRow | null;
  emptyLabel: string;
  shortcuts: ShortcutItem[];
};

export function AdminSelectedEventSummary({
  selectedEvent,
  emptyLabel,
  shortcuts,
}: Props) {
  if (!selectedEvent) {
    return <p className="text-[13px] text-[var(--color-text-muted)]">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
          {selectedEvent.name}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
          {new Date(selectedEvent.competitionStartDate).toLocaleDateString()} -{' '}
          {new Date(selectedEvent.competitionEndDate).toLocaleDateString()}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {shortcuts.map((shortcut) => (
          <Link
            key={shortcut.key}
            href={shortcut.href}
            className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
          >
            {shortcut.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
