'use client';

type Props = {
  issueCount: number;
  onJump: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function DrawWarningBanner({ issueCount, onJump, t }: Props) {
  if (issueCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onJump}
      className="sticky top-[var(--topbar-height)] z-10 flex min-h-[44px] w-full items-center justify-between rounded-[var(--radius-card)] border border-amber-500/40 bg-amber-500/10 px-3 text-[12px] font-semibold text-amber-300"
    >
      <span>
        ⚠ {issueCount} {t('validationWarningsTitle')}
      </span>
      <span>{t('validationTitle')}</span>
    </button>
  );
}
