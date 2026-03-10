'use client';

type Props = {
  activeTab: 'categories' | 'selected';
  onChange: (tab: 'categories' | 'selected') => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function DrawMobileTabs({ activeTab, onChange, t }: Props) {
  return (
    <div className="md:hidden">
      <div className="grid grid-cols-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <button
          type="button"
          onClick={() => onChange('categories')}
          className={`min-h-[44px] rounded-[var(--radius-pill)] px-3 text-[13px] font-semibold ${
            activeTab === 'categories'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)]'
          }`}
        >
          {t('filterTab')}
        </button>
        <button
          type="button"
          onClick={() => onChange('selected')}
          className={`min-h-[44px] rounded-[var(--radius-pill)] px-3 text-[13px] font-semibold ${
            activeTab === 'selected'
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-text)]'
              : 'text-[var(--color-text-muted)]'
          }`}
        >
          {t('statusTab')}
        </button>
      </div>
    </div>
  );
}
