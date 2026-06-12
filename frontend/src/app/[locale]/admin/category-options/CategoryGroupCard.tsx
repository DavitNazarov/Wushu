'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import { localizedName } from '@/lib/bilingual';
import type { CategoryOptionGroupRow } from '@/types/api';
import { formatWeightRange } from './categoryOptions.utils';

type Props = {
  group: CategoryOptionGroupRow;
  onEdit: () => void;
  onDelete: () => void;
};

export function CategoryGroupCard({ group, onEdit, onDelete }: Props) {
  const locale = useLocale();
  const t = useTranslations('admin.categoryOptions');
  const tIdentity = useTranslations('athleteProfile.identity');

  const name = localizedName(group.name, group.nameKa, locale);
  const sexLabel = group.sex ? tIdentity(`sexValue.${group.sex}`) : t('openDivision');
  const ageLabel =
    group.minAge != null || group.maxAge != null
      ? t('ageRange', { min: group.minAge ?? '—', max: group.maxAge ?? '—' })
      : t('ageAny');
  const roundLabel = t('roundMinutes', { minutes: group.roundDurationSeconds / 60 });

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[var(--color-text)]">
              {name}
            </h3>
            {!group.isActive && (
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {t('inactive')}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {sexLabel}
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {ageLabel}
            </span>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {roundLabel}
            </span>
            <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              {t('weightCount', { count: group.options.length })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('actions.edit')}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('actions.delete')}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] transition hover:border-[var(--color-danger)]/40 hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]/40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-[var(--color-border)]/70 pt-3">
        {group.options.map((option) => (
          <span
            key={option.id}
            title={formatWeightRange(option.minWeightKgExcl, option.maxWeightKgIncl)}
            className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 py-1 text-[12px] font-medium tabular-nums text-[var(--color-text)]"
          >
            {option.name}
          </span>
        ))}
      </div>
    </div>
  );
}
