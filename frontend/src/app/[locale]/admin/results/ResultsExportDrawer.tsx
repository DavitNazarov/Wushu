'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Scale,
} from 'lucide-react';
import { apiBlob, apiGet, downloadBlob } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { useToast } from '@/components/ui/Toast';

export type ResultsExportType = 'results' | 'schedule' | 'weighin';
type ExportLang = 'en' | 'ka';
type SignatureTemplate = { id: string; judgeNameEn: string; judgeNameKa: string | null };

type Props = {
  open: boolean;
  eventId: string;
  onClose: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
};

const ITEMS: Array<{
  type: ResultsExportType;
  Icon: ComponentType<{ className?: string }>;
}> = [
  { type: 'results', Icon: FileText },
  { type: 'schedule', Icon: CalendarDays },
  { type: 'weighin', Icon: Scale },
];

const LANGS: Array<{ value: ExportLang; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ka', label: 'ქართული' },
];

const SEL =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export function ResultsExportDrawer({ open, eventId, onClose, t, tCommon }: Props) {
  const locale = useLocale();
  const { toast } = useToast();
  const [lang, setLang] = useState<ExportLang>(locale === 'ka' ? 'ka' : 'en');
  const [busy, setBusy] = useState<ResultsExportType | null>(null);
  const [templateId, setTemplateId] = useState('');

  const { data: templates } = useQuery({
    queryKey: ['signature-templates'],
    queryFn: () => apiGet<SignatureTemplate[]>('/api/signature-templates'),
    enabled: open,
  });

  // Default the selector to the first available template.
  useEffect(() => {
    if (templates && templates.length > 0 && !templateId) {
      setTemplateId(templates[0].id);
    }
  }, [templates, templateId]);

  const manageHref = `/${locale}/admin/signatures`;

  async function download(type: ResultsExportType) {
    if (!eventId || busy) return;
    const params = new URLSearchParams({ lang });
    if (type === 'results') {
      if (!templateId) return;
      params.set('templateId', templateId);
    }
    setBusy(type);
    try {
      const blob = await apiBlob(`/api/exports/${eventId}/${type}.pdf?${params.toString()}`);
      downloadBlob(blob, `${type}-${lang}.pdf`);
      toast(tCommon('saveSuccess'));
    } catch (e) {
      toast(getCompactErrorMessage(e, tCommon('error')), 'error');
    } finally {
      setBusy(null);
    }
  }

  const hasTemplates = (templates?.length ?? 0) > 0;

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
        className={`absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t('export')}</h2>
          <button
            type="button"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            onClick={onClose}
          >
            {tCommon('close')}
          </button>
        </div>
        <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">{t('exportHint')}</p>

        {/* Language */}
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('exportLanguage')}
          </p>
          <div className="inline-flex rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            {LANGS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLang(l.value)}
                className={`rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[13px] ${
                  lang === l.value
                    ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Head-judge signature (required for results) */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {t('export_signature')}
            </p>
            <a
              href={manageHref}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[var(--color-primary)] hover:underline"
            >
              {t('export_signature_manage')}
            </a>
          </div>
          {hasTemplates ? (
            <select className={SEL} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates!.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {locale === 'ka' && tpl.judgeNameKa ? tpl.judgeNameKa : tpl.judgeNameEn}
                </option>
              ))}
            </select>
          ) : (
            <a
              href={manageHref}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[var(--radius-input)] border border-dashed border-[var(--color-border)] px-3 py-2 text-[12px] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]"
            >
              {t('export_signature_create')}
            </a>
          )}
        </div>

        <div className="space-y-2">
          {ITEMS.map(({ type, Icon }) => {
            const isBusy = busy === type;
            const blocked = type === 'results' && !templateId;
            return (
              <button
                key={type}
                type="button"
                disabled={!eventId || busy !== null || blocked}
                onClick={() => download(type)}
                className="group flex w-full items-center gap-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-[var(--color-text)]">
                    {t(`export_${type}`)}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
                    {blocked ? t('export_signature_required') : t(`export_${type}_hint`)}
                  </span>
                </span>
                {isBusy ? (
                  <Loader2 className="h-4 w-4 flex-none animate-spin text-[var(--color-text-muted)]" />
                ) : (
                  <Download className="h-4 w-4 flex-none text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]" />
                )}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
