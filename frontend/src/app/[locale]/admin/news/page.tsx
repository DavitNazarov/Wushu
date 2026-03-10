'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { NewsPostRow } from '@/types/api';
import type { PublicEvent } from '@/lib/api/public';
import { Field } from '@/components/form/Field';
import { TextInput } from '@/components/form/TextInput';
import { Textarea } from '@/components/form/Textarea';
import { Select } from '@/components/form/Select';
import { Checkbox } from '@/components/form/Checkbox';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

type FormState = { title: string; slug: string; body: string; published: boolean; eventId: string };
const emptyForm: FormState = { title: '', slug: '', body: '', published: false, eventId: '' };

export default function NewsPage() {
  const t = useTranslations('news');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editId, setEditId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: posts, isLoading, error, refetch } = useQuery({
    queryKey: ['news'],
    queryFn: () => apiGet<NewsPostRow[]>('/api/admin/news'),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['public', 'events'],
    queryFn: async () => {
      const res = await fetch('/api/public/events', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load events');
      return res.json() as Promise<PublicEvent[]>;
    },
    enabled: modalOpen,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<NewsPostRow>('/api/admin/news', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast(tCommon('saveSuccess'));
      closeModal();
    },
    onError: (err) => {
      const msg = err instanceof ApiError
        ? err.message
        : getCompactErrorMessage(err, tCommon('saveFailed'));
      toast(msg, 'error');
    },
  });

  function openEdit(post: NewsPostRow) {
    setEditId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      body: post.body ?? '',
      published: post.published,
      eventId: post.eventId ?? '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
  }

  function handleSave() {
    const payload: Record<string, unknown> = {
      ...form,
      eventId: form.eventId || null,
    };
    if (editId) payload.id = editId;
    saveMutation.mutate(payload);
  }

  function handleTitleChange(value: string) {
    setForm((f) => ({
      ...f,
      title: value,
      slug: !f.slug || f.slug === slugify(f.title) ? slugify(value) : f.slug,
    }));
  }

  const filtered = posts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <Link href="/admin/news/new">
            <PrimaryButton>{t('create')}</PrimaryButton>
          </Link>
        }
      />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <SkeletonRows rows={5} cols={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Link href="/admin/news/new">
              <PrimaryButton>{t('create')}</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.title')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.slug')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('fields.event')}</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('columns.published')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((post) => (
                  <tr
                    key={post.id}
                    onClick={() => openEdit(post)}
                    className="cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{post.title}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{post.slug}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{post.event?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold ${
                        post.published
                          ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                      }`}>
                        {post.published ? tCommon('publish') : 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            {filtered.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => openEdit(post)}
                className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:bg-[var(--color-surface-alt)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{post.title}</p>
                  <span className={`inline-flex shrink-0 items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold ${
                    post.published
                      ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                  }`}>
                    {post.published ? tCommon('publish') : 'Draft'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{post.slug}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editId ? form.title || t('fields.title') : t('new')}
        footer={
          <>
            <SecondaryButton onClick={closeModal}>{tCommon('cancel')}</SecondaryButton>
            <PrimaryButton
              disabled={saveMutation.isPending || !form.title.trim() || !form.slug.trim()}
              onClick={handleSave}
            >
              {saveMutation.isPending ? tCommon('loading') : tCommon('save')}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field id="modal-title" label={t('fields.title')}>
            <TextInput
              id="modal-title"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </Field>
          <Field id="modal-slug" label={t('fields.slug')}>
            <TextInput
              id="modal-slug"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </Field>
          <Field id="modal-body" label={t('fields.body')}>
            <Textarea
              id="modal-body"
              value={form.body}
              className="h-32"
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </Field>
          <Field id="modal-eventId" label={t('fields.event')}>
            <Select
              id="modal-eventId"
              value={form.eventId}
              onChange={(v) => setForm((f) => ({ ...f, eventId: v }))}
              placeholder={t('fields.eventPlaceholder')}
              options={events.map((ev) => ({ value: ev.id, label: ev.name }))}
            />
          </Field>
          <Checkbox
            id="modal-published"
            checked={form.published}
            onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))}
            label={t('fields.published')}
          />
        </div>
      </Modal>
    </div>
  );
}
