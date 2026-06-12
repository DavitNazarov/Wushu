'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, UploadCloud } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';

export type SignatureTemplate = {
  id: string;
  judgeNameEn: string;
  judgeNameKa: string | null;
  createdAt: string;
};

const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

// Read an image file, downscale it on a canvas, and return a small data URL so
// the upload stays within the API body limit.
async function fileToSignatureDataUrl(file: File, maxWidth = 480): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('decode_failed'));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxWidth / (img.width || maxWidth));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  let out = canvas.toDataURL('image/png');
  if (out.length > 80_000) out = canvas.toDataURL('image/jpeg', 0.85);
  return out;
}

export function SignatureTemplatesClient() {
  const t = useTranslations('signatures');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nameEn, setNameEn] = useState('');
  const [nameKa, setNameKa] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['signature-templates'],
    queryFn: () => apiGet<SignatureTemplate[]>('/api/signature-templates'),
  });
  const templates = data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: { judgeNameEn: string; judgeNameKa: string | null; signature: string }) =>
      apiPost('/api/signature-templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-templates'] });
      setNameEn('');
      setNameKa('');
      setSignature(null);
      if (fileRef.current) fileRef.current.value = '';
      toast(tCommon('saveSuccess'));
    },
    onError: (e) => toast(getCompactErrorMessage(e, tCommon('saveFailed')), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/signature-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-templates'] });
      toast(tCommon('saveSuccess'));
    },
    onError: (e) => toast(getCompactErrorMessage(e, tCommon('error')), 'error'),
  });

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    try {
      setSignature(await fileToSignatureDataUrl(file));
    } catch {
      toast(t('uploadFailed'), 'error');
    }
  }

  function onSubmit() {
    if (!nameEn.trim() || !signature) return;
    createMutation.mutate({
      judgeNameEn: nameEn.trim(),
      judgeNameKa: nameKa.trim() || null,
      signature,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      <p className="-mt-3 text-[13px] text-[var(--color-text-muted)]">{t('subtitle')}</p>

      {/* Create */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-[14px] font-semibold text-[var(--color-text)]">{t('addTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">{t('nameEn')}</span>
            <input className={INPUT} value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Avtandil Jishiashvili" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">{t('nameKa')}</span>
            <input className={INPUT} value={nameKa} onChange={(e) => setNameKa(e.target.value)} placeholder="ავთანდილ ჯიშიაშვილი" />
          </label>
        </div>

        <div className="mt-3">
          <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">{t('signatureLabel')}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-input)] border border-[var(--color-border)] px-3 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]"
            >
              <UploadCloud className="h-4 w-4" /> {t('chooseImage')}
            </button>
            {signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature} alt="signature preview" className="h-12 max-w-[200px] rounded border border-[var(--color-border)] bg-white object-contain p-1" />
            ) : (
              <span className="text-[12px] text-[var(--color-text-muted)]">{t('noImage')}</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{t('signatureHint')}</p>
        </div>

        <div className="mt-4">
          <PrimaryButton
            className="h-10"
            disabled={!nameEn.trim() || !signature || createMutation.isPending}
            onClick={onSubmit}
          >
            {createMutation.isPending ? tCommon('loading') : t('save')}
          </PrimaryButton>
        </div>
      </section>

      {/* List */}
      {isLoading ? (
        <SkeletonRows rows={3} cols={2} />
      ) : templates.length === 0 ? (
        <EmptyState title={t('empty')} description={t('subtitle')} />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
                <th className="px-4 py-3 text-left font-medium">{t('nameEn')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('nameKa')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {templates.map((tpl) => (
                <tr key={tpl.id} className="bg-[var(--color-surface)]">
                  <td className="px-4 py-3 text-[var(--color-text)]">{tpl.judgeNameEn}</td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{tpl.judgeNameKa ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(t('deleteConfirm'))) deleteMutation.mutate(tpl.id);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-red-500"
                      aria-label={tCommon('delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
