'use client';

import { useEffect } from 'react';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { getErrorCode, getErrorIssues, getErrorMessage } from '@/lib/api/error';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = getErrorMessage(error, 'Something went wrong in Admin UI.');
  const code = getErrorCode(error);
  const issues = getErrorIssues(error);

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-[var(--radius-card)] border border-[var(--color-danger)]/25 bg-[var(--color-surface)] p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">
        Admin page failed to render
      </h2>
      <p className="text-[13px] text-[var(--color-text-muted)]">{message}</p>
      {(code || error.digest) && (
        <div className="space-y-1 text-[12px] text-[var(--color-text-muted)]">
          {code && <p>Code: {code}</p>}
          {error.digest && <p>Digest: {error.digest}</p>}
        </div>
      )}
      {issues.length > 0 && (
        <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] p-3 text-[12px] text-[var(--color-text-muted)]">
          {issues.slice(0, 6).map((issue) => (
            <p key={issue}>- {issue}</p>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <PrimaryButton onClick={reset}>Retry</PrimaryButton>
        <SecondaryButton onClick={() => window.location.reload()}>
          Reload Page
        </SecondaryButton>
      </div>
    </div>
  );
}
