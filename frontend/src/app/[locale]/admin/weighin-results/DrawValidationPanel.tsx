'use client';

import { InlineAlert } from '@/components/ui/InlineAlert';
import type { DrawOverviewResponse } from '@/types/api';

type Props = {
  overview: DrawOverviewResponse;
  sectionId?: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

function IssueList({
  title,
  issues,
  tone,
  t,
}: {
  title: string;
  issues: DrawOverviewResponse['validation']['critical'];
  tone: 'error' | 'warning';
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  if (issues.length === 0) return null;

  return (
    <InlineAlert variant={tone}>
      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold">{title}</p>
        {issues.map((issue) => (
          <p key={issue.code} className="text-[12px]">
            {t(`issueCode.${issue.code}`)} ({issue.count})
          </p>
        ))}
      </div>
    </InlineAlert>
  );
}

export function DrawValidationPanel({ overview, sectionId, t }: Props) {
  return (
    <section
      id={sectionId}
      className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <h3 className="text-[14px] font-semibold text-[var(--color-text)]">
        {t('validationTitle')}
      </h3>

      <IssueList
        title={t('validationCriticalTitle')}
        issues={overview.validation.critical}
        tone="error"
        t={t}
      />

      <IssueList
        title={t('validationWarningsTitle')}
        issues={overview.validation.warnings}
        tone="warning"
        t={t}
      />

      {overview.validation.critical.length === 0 &&
        overview.validation.warnings.length === 0 && (
          <InlineAlert variant="success">
            <p className="text-[13px] font-semibold">{t('validationHealthy')}</p>
          </InlineAlert>
        )}

      <div className="space-y-2">
        <p className="text-[13px] font-semibold text-[var(--color-text)]">
          {t('auditTitle')}
        </p>
        <div className="space-y-1">
          {overview.audit.recent.map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[12px]"
            >
              <p className="font-medium text-[var(--color-text)]">
                {t(`auditAction.${item.action}`)}
              </p>
              <p className="mt-0.5 text-[var(--color-text-muted)]">
                {new Date(item.createdAt).toLocaleString()} ·{' '}
                {item.actorDisplayName ?? t('unknownUser')}
              </p>
              {item.reason && (
                <p className="mt-0.5 text-[var(--color-text-muted)]">
                  {t('reasonLabel')}: {item.reason}
                </p>
              )}
            </div>
          ))}

          {overview.audit.recent.length === 0 && (
            <p className="text-[12px] text-[var(--color-text-muted)]">{t('auditEmpty')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
