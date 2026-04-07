'use client';

import { useTranslations } from 'next-intl';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { ValidationIssue } from '@/types/api';

type Props = {
  issues: ValidationIssue[];
};

export function EventValidationIssuesAlert({ issues }: Props) {
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');

  if (issues.length === 0) return null;

  return (
    <InlineAlert variant="error">
      <p className="text-[12px] font-medium">
        {tCommon('error')}: {tEvents('validation.summary')}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px]">
        {issues.slice(0, 5).map((issue, index) => (
          <li key={`${issue.path}-${index}`}>
            <span className="font-mono">{issue.path}</span>: {issue.message}
          </li>
        ))}
        {issues.length > 5 ? (
          <li>{tEvents('validation.more', { count: issues.length - 5 })}</li>
        ) : null}
      </ul>
    </InlineAlert>
  );
}
