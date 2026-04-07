'use client';

type Props = {
  totalCategories: number;
  completedCategories: number;
  needsReview: number;
  t: (key: string) => string;
};

export function ResultsSummaryCards({
  totalCategories,
  completedCategories,
  needsReview,
  t,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]">
        {t('totalCategories')}: <strong>{totalCategories}</strong>
      </div>
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]">
        {t('completedCategories')}: <strong>{completedCategories}</strong>
      </div>
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]">
        {t('needsReviewCategories')}: <strong>{needsReview}</strong>
      </div>
    </div>
  );
}
