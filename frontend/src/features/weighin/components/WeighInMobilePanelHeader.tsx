'use client';

import { ArrowLeft } from 'lucide-react';

type Props = {
  backLabel: string;
  queueLabel: string;
  selectedAthleteName: string;
  onBack: () => void;
};

/**
 * Slim sticky sub-bar shown only on mobile, pinned directly under the app top bar.
 * Back affordance + queue eyebrow + athlete name — no floating card, no leading gap.
 */
export function WeighInMobilePanelHeader({
  backLabel,
  queueLabel,
  selectedAthleteName,
  onBack,
}: Props) {
  return (
    <div
      className="sticky top-[var(--topbar-height)] z-30 -mx-4 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 md:hidden"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition active:scale-95 hover:bg-[var(--color-surface-alt)]"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {queueLabel}
        </p>
        <p className="truncate text-[15px] font-semibold leading-tight text-[var(--color-text)]">
          {selectedAthleteName}
        </p>
      </div>
    </div>
  );
}
