'use client';

import { Download } from 'lucide-react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';

export type ResultsExportType = 'registrations' | 'brackets' | 'schedule' | 'results';

type ExportLink = {
  type: ResultsExportType;
  url: string;
  id: string;
};

type Props = {
  open: boolean;
  eventId: string;
  exportTypes: Record<ResultsExportType, boolean>;
  exportLinks: ExportLink[];
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onExportTypeChange: (type: ResultsExportType, checked: boolean) => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
};

const EXPORT_TYPES: ResultsExportType[] = ['registrations', 'brackets', 'schedule', 'results'];

export function ResultsExportDrawer({
  open,
  eventId,
  exportTypes,
  exportLinks,
  isGenerating,
  onClose,
  onGenerate,
  onExportTypeChange,
  t,
  tCommon,
}: Props) {
  return (
    <div
      className={`fixed inset-0 z-40 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/45 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[420px] border-l border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t('export')}</h2>
          <button
            type="button"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            onClick={onClose}
          >
            {tCommon('close')}
          </button>
        </div>

        <div className="space-y-2">
          {EXPORT_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 rounded-[var(--radius-input)] border border-[var(--color-border)] px-3 py-2 text-[13px]"
            >
              <input
                type="checkbox"
                checked={exportTypes[type]}
                onChange={(event) => onExportTypeChange(type, event.target.checked)}
              />
              <span>{type}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <PrimaryButton
            className="h-10"
            disabled={!eventId || isGenerating || !EXPORT_TYPES.some((type) => exportTypes[type])}
            onClick={onGenerate}
          >
            {isGenerating ? tCommon('loading') : tCommon('create')}
          </PrimaryButton>
          <SecondaryButton className="h-10" onClick={onClose}>
            {tCommon('cancel')}
          </SecondaryButton>
        </div>

        {exportLinks.length > 0 ? (
          <div className="mt-5 space-y-2">
            {exportLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[var(--radius-input)] border border-[var(--color-border)] px-3 py-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]"
              >
                <span>{link.type}</span>
                <Download className="h-4 w-4 text-[var(--color-text-muted)]" />
              </a>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
