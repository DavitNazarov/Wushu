'use client';

import { InlineAlert } from '@/components/ui/InlineAlert';
import {
  getErrorCode,
  getErrorIssues,
  getErrorMessage,
} from '@/lib/api/error';

type Props = {
  error: unknown;
  fallbackMessage: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function AdminErrorAlert({
  error,
  fallbackMessage,
  retryLabel,
  onRetry,
}: Props) {
  const message = getErrorMessage(error, fallbackMessage);
  const code = getErrorCode(error);
  const issues = getErrorIssues(error);

  return (
    <InlineAlert
      variant="error"
      actions={
        onRetry ? (
          <button
            onClick={onRetry}
            className="text-[13px] font-medium underline"
          >
            {retryLabel ?? 'Retry'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-1.5">
        <p>{message}</p>
        {code && (
          <p className="text-[12px] opacity-90">Code: {code}</p>
        )}
        {issues.length > 0 && (
          <div className="space-y-0.5 text-[12px] opacity-95">
            {issues.slice(0, 4).map((issue) => (
              <p key={issue}>- {issue}</p>
            ))}
          </div>
        )}
      </div>
    </InlineAlert>
  );
}
