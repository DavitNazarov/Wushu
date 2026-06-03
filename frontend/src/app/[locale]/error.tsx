'use client';

import { useEffect } from 'react';
import { getErrorMessage } from '@/lib/api/error';

// REL-4: locale-level error boundary for public/coach/login surfaces that
// previously had none (only /admin had one). Branded recovery instead of a
// Next dev error / white screen.
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = getErrorMessage(
    error,
    'An unexpected error occurred while loading this page.',
  );

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">
        Something went wrong
      </h2>
      <p className="text-[13px] text-[var(--color-text-muted)]">{message}</p>
      <button
        onClick={() => reset()}
        className="h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] px-4 text-[13px] text-[var(--color-text)] transition hover:bg-[var(--color-surface-alt)]"
      >
        Try again
      </button>
    </div>
  );
}
