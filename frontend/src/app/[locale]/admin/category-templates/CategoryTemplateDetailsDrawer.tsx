'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Trash2, X } from 'lucide-react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { CARD_CLASS } from './categoryTemplate.constants';
import {
  categoryTemplateStatusKey,
  categoryTemplateTypeKey,
  formatDateTime,
  formatWeightLabel,
} from './categoryTemplate.utils';
import { apiGet } from '@/lib/api/client';
import type { CategoryTemplateDetailRow } from '@/types/api';

type Props = {
  templateId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (templateId: string) => void;
  onDelete: (template: CategoryTemplateDetailRow) => void;
};

export function CategoryTemplateDetailsDrawer({
  templateId,
  open,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const tIdentity = useTranslations('athleteProfile.identity');
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['category-template', templateId],
    queryFn: () => apiGet<CategoryTemplateDetailRow>(`/api/category-templates/${templateId}`),
    enabled: open && Boolean(templateId),
  });

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !templateId) return null;

  const template = query.data ?? null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-[60] md:left-auto md:w-[min(560px,100vw)]">
        <div className="flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t('details.title')}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                {template?.name ?? tCommon('loading')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {query.isLoading && (
              <div className="space-y-3">
                <div className="h-6 w-40 animate-pulse rounded bg-[var(--color-surface-alt)]" />
                <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
                <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
              </div>
            )}

            {query.error && !template && (
              <AdminErrorAlert
                error={query.error}
                fallbackMessage={tCommon('loadError')}
                retryLabel={tCommon('retry')}
                onRetry={() => query.refetch()}
              />
            )}

            {template && (
              <div className="space-y-5">
                <section className={`${CARD_CLASS} p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--color-text)]">{template.name}</p>
                      <p className="text-[13px] text-[var(--color-text-muted)]">
                        {t(categoryTemplateTypeKey(template.type))} · v{template.version}
                      </p>
                    </div>
                    <StatusChip
                      status={template.status}
                      label={t(categoryTemplateStatusKey(template.status))}
                      domain="categoryTemplate"
                    />
                  </div>

                  <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
                    <div><dt className="text-[var(--color-text-muted)]">{t('columns.type')}</dt><dd>{t(categoryTemplateTypeKey(template.type))}</dd></div>
                    <div><dt className="text-[var(--color-text-muted)]">{t('columns.source')}</dt><dd>{template.sourceLabel ?? '—'}</dd></div>
                    <div><dt className="text-[var(--color-text-muted)]">{t('columns.updated')}</dt><dd>{formatDateTime(template.updatedAt, locale)}</dd></div>
                    <div><dt className="text-[var(--color-text-muted)]">{t('details.createdAt')}</dt><dd>{formatDateTime(template.createdAt, locale)}</dd></div>
                  </dl>
                </section>

                <section className={`${CARD_CLASS} p-4`}>
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{t('details.summaryTitle')}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('details.kpis.ageGroups')}</p><p className="mt-1 text-lg font-semibold">{template.counts.ageGroups}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('details.kpis.genders')}</p><p className="mt-1 text-lg font-semibold">{template.counts.genders}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('details.kpis.weightCategories')}</p><p className="mt-1 text-lg font-semibold">{template.counts.weightCategories}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('details.kpis.events')}</p><p className="mt-1 text-lg font-semibold">{template.usage.snapshotCount}</p></div>
                  </div>
                </section>

                {template.permissions.reasonCodes.length > 0 && (
                  <InlineAlert variant="warning">
                    {template.permissions.reasonCodes
                      .map((reason) => t(`errors.${reason}` as Parameters<typeof t>[0]))
                      .join(' ')}
                  </InlineAlert>
                )}

                <section className={`${CARD_CLASS} p-4`}>
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{t('details.usageTitle')}</h3>
                  <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                    {t('details.usageSummary', {
                      events: template.usage.snapshotCount,
                      ageGroups: template.usage.eventAgeGroupCount,
                      categories: template.usage.eventWeightCategoryCount,
                    })}
                  </p>
                  <div className="mt-3 space-y-2">
                    {template.usage.recentEvents.length === 0 ? (
                      <p className="text-[13px] text-[var(--color-text-muted)]">{t('details.noUsage')}</p>
                    ) : (
                      template.usage.recentEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                        >
                          <p className="text-[13px] font-medium text-[var(--color-text)]">{event.name}</p>
                          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                            {event.lifecycle} · {formatDateTime(event.competitionStartDate, locale)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className={`${CARD_CLASS} p-4`}>
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{t('details.structureTitle')}</h3>
                  <div className="mt-3 space-y-3">
                    {template.ageGroups.map((ageGroup) => (
                      <div
                        key={ageGroup.id}
                        className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[14px] font-semibold text-[var(--color-text)]">{ageGroup.name}</p>
                            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                              {ageGroup.code} · {ageGroup.minAge ?? '—'}-{ageGroup.maxAge ?? '—'} ·{' '}
                              {ageGroup.sex ? tIdentity(`sexValue.${ageGroup.sex}`) : t('details.openDivision')}
                            </p>
                          </div>
                          <p className="text-[12px] text-[var(--color-text-muted)]">
                            {t('details.roundMinutes', { count: ageGroup.roundDurationSeconds / 60 })}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ageGroup.weightCategories.map((weight) => (
                            <span
                              key={weight.id}
                              className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text)]"
                            >
                              {formatWeightLabel(weight.minWeightKgExcl, weight.maxWeightKgIncl)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>

          {template && (
            <div className="border-t border-[var(--color-border)] px-5 py-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <PrimaryButton disabled={!template.permissions.canEdit} onClick={() => onEdit(template.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {tCommon('edit')}
                </PrimaryButton>
                <SecondaryButton
                  className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                  disabled={!template.permissions.canDelete}
                  onClick={() => onDelete(template)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {tCommon('delete')}
                </SecondaryButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
