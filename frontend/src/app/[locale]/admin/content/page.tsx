/* Admin News content editor (MVP for P2-02) */
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';

type NewsItem = {
  id: string;
  title: string;
  slug: string;
  body: string;
  publishedAt: string | null;
};

type FetchState = 'idle' | 'loading' | 'error';

export default function AdminContentPage() {
  const tAdmin = useTranslations('admin');
  const tContent = useTranslations('content');

  const [items, setItems] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setFetchState('loading');
      try {
        const response = await fetch('/api/admin/news', { credentials: 'include' });
        if (!response.ok) {
          throw new Error('FETCH_FAILED');
        }
        const data = (await response.json()) as NewsItem[];
        if (!cancelled) {
          setItems(data);
          setFetchState('idle');
        }
      } catch {
        if (!cancelled) {
          setFetchState('error');
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setTitle('');
      setSlug('');
      setBody('');
      setPublished(false);
      return;
    }

    setTitle(selectedItem.title);
    setSlug(selectedItem.slug);
    setBody(selectedItem.body);
    setPublished(Boolean(selectedItem.publishedAt));
  }, [selectedItem]);

  async function handleSave() {
    if (!title.trim() || !slug.trim()) {
      setError(tContent('validationRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/news', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedItem?.id,
          title: title.trim(),
          slug: slug.trim(),
          body,
          published,
        }),
      });

      if (!response.ok) {
        setError(tContent('saveError'));
        setSaving(false);
        return;
      }

      const saved = (await response.json()) as NewsItem;
      setItems((current) => {
        const existingIndex = current.findIndex((item) => item.id === saved.id);
        if (existingIndex === -1) {
          return [saved, ...current];
        }
        const copy = [...current];
        copy[existingIndex] = saved;
        return copy;
      });
      setSelectedId(saved.id);
      setSaving(false);
    } catch {
      setError(tContent('saveError'));
      setSaving(false);
    }
  }

  function handleNew() {
    setSelectedId(null);
    setTitle('');
    setSlug('');
    setBody('');
    setPublished(false);
    setError(null);
  }

  return (
    <AppShell title={tContent('title')}>
      <div className="flex gap-6">
        <div className="w-1/2 space-y-4">
          <SectionHeader
            title={tContent('newsListTitle')}
            action={
              <PrimaryButton onClick={handleNew}>
                {tContent('newPost')}
              </PrimaryButton>
            }
          />

          {fetchState === 'error' && (
            <p className="text-[13px] text-[var(--color-danger)]">{tContent('loadError')}</p>
          )}

          {items.length === 0 && fetchState === 'idle' && (
            <EmptyState
              title={tContent('emptyTitle')}
              description={tContent('emptyDescription')}
            />
          )}

          {items.length > 0 && (
            <Table>
              <TableHead>
                <TableHeader>{tContent('columns.title')}</TableHeader>
                <TableHeader>{tContent('columns.status')}</TableHeader>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} onClick={() => setSelectedId(item.id)}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell muted>{item.publishedAt ? tContent('statusPublished') : tContent('statusDraft')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="w-1/2 space-y-4">
          <SectionHeader title={tContent('editorTitle')} />
          <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-[var(--color-text)]">
                {tContent('fields.title')}
              </label>
              <input
                className="h-9 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-[var(--color-text)]">
                {tContent('fields.slug')}
              </label>
              <input
                className="h-9 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-[var(--color-text)]">
                {tContent('fields.body')}
              </label>
              <textarea
                className="h-40 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {tContent('bodyHint')}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-[13px] text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(event) => setPublished(event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                {tContent('fields.published')}
              </label>
              <PrimaryButton
                className="h-9 px-4 text-[13px]"
                disabled={saving}
                onClick={() => {
                  void handleSave();
                }}
              >
                {saving ? tContent('saving') : tContent('save')}
              </PrimaryButton>
            </div>
            {error && <p className="text-[12px] text-[var(--color-danger)]">{error}</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

