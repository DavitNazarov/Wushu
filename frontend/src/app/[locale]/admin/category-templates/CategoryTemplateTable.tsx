'use client';

import { useLocale, useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/StatusChip';
import type { CategoryTemplateRow } from '@/types/api';
import { categoryTemplateStatusKey, categoryTemplateTypeKey, formatDateTime } from './categoryTemplate.utils';
import { CategoryTemplateRowActions } from './CategoryTemplateRowActions';

type Props = {
  templates: CategoryTemplateRow[];
  onView: (template: CategoryTemplateRow) => void;
  onEdit: (template: CategoryTemplateRow) => void;
  onDelete: (template: CategoryTemplateRow) => void;
  onActivate: (template: CategoryTemplateRow) => void;
};

export function CategoryTemplateTable({
  templates,
  onView,
  onEdit,
  onDelete,
  onActivate,
}: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const locale = useLocale();

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
      <table className="min-w-full text-[13px]">
        <thead>
          <tr className="bg-[var(--color-surface-alt)]">
            <Column>{t('columns.name')}</Column>
            <Column>{t('columns.version')}</Column>
            <Column>{t('columns.status')}</Column>
            <Column>{t('columns.type')}</Column>
            <Column>{t('columns.updated')}</Column>
            <Column>{t('columns.usage')}</Column>
            <Column>{t('columns.actions')}</Column>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {templates.map((template) => (
            <tr key={template.id} className="bg-[var(--color-surface)] align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-[var(--color-text)]">{template.name}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {template.sourceLabel ?? '—'}
                </p>
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">v{template.version}</td>
              <td className="px-4 py-3">
                <StatusChip
                  status={template.status}
                  label={t(categoryTemplateStatusKey(template.status))}
                  domain="categoryTemplate"
                />
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">
                {template.type ? t(categoryTemplateTypeKey(template.type)) : '—'}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">
                {formatDateTime(template.updatedAt, locale)}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">
                {template.usageCount
                  ? t('usage.eventsCount', { count: template.usageCount })
                  : t('usage.unused')}
              </td>
              <td className="px-4 py-3">
                <CategoryTemplateRowActions
                  template={template}
                  onView={() => onView(template)}
                  onEdit={() => onEdit(template)}
                  onDelete={() => onDelete(template)}
                  onActivate={() => onActivate(template)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
      {children}
    </th>
  );
}
