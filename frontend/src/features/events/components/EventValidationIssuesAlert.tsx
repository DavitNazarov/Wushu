'use client';

import { useTranslations } from 'next-intl';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { ValidationIssue } from '@/types/api';

type Props = {
  issues: ValidationIssue[];
};

export function EventValidationIssuesAlert({ issues }: Props) {
  const tEvents = useTranslations('admin.events');

  if (issues.length === 0) return null;

  // Surface each distinct human-readable reason. The raw Zod field path
  // (e.g. "dates.registrationDays") is intentionally omitted — the offending
  // fields are already highlighted inline and the wizard jumps to their step.
  const messages = Array.from(new Set(issues.map((issue) => issue.message)));

  return (
    <InlineAlert variant="error">
      <p className="text-[12px] font-medium">{tEvents('validation.summary')}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px]">
        {messages.slice(0, 5).map((message, index) => (
          <li key={index}>{message}</li>
        ))}
        {messages.length > 5 ? (
          <li>{tEvents('validation.more', { count: messages.length - 5 })}</li>
        ) : null}
      </ul>
    </InlineAlert>
  );
}
