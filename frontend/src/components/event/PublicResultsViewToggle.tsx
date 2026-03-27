'use client';

type ResultsView = 'categories' | 'clubs';

type Props = {
  value: ResultsView;
  onChange: (value: ResultsView) => void;
  t: (key: string) => string;
};

export function PublicResultsViewToggle({ value, onChange, t }: Props) {
  const views: Array<{ id: ResultsView; label: string }> = [
    { id: 'categories', label: t('resultsViewByCategory') },
    { id: 'clubs', label: t('resultsViewByClub') },
  ];

  return (
    <div className="inline-flex rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-1">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onChange(view.id)}
          aria-pressed={value === view.id}
          className={`rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[13px] font-medium transition ${
            value === view.id
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
