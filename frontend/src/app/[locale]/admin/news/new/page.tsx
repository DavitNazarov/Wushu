'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { apiPost, ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { useQuery } from '@tanstack/react-query';
import type { NewsPostRow } from '@/types/api';
import type { PublicEvent } from '@/lib/api/public';
import { Field } from '@/components/form/Field';
import { TextInput } from '@/components/form/TextInput';
import { Textarea } from '@/components/form/Textarea';
import { Select } from '@/components/form/Select';
import { Checkbox } from '@/components/form/Checkbox';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function isValidSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

export default function CreateNewsPage() {
  const t = useTranslations('news');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(false);
  const [eventId, setEventId] = useState<string>('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: events = [], error: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ['public', 'events'],
    queryFn: async () => {
      const res = await fetch('/api/public/events', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load events');
      return res.json() as Promise<PublicEvent[]>;
    },
  });

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched || slug === slugify(title)) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!title.trim()) {
      setError(t('fields.title') + ' is required');
      setIsSubmitting(false);
      return;
    }
    if (!slug.trim()) {
      setError(t('fields.slug') + ' is required');
      setIsSubmitting(false);
      return;
    }
    if (!isValidSlug(slug)) {
      setError(t('validationSlug'));
      setIsSubmitting(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        slug: slug.trim(),
        body: body.trim(),
        published,
        eventId: eventId || null,
      };
      await apiPost<NewsPostRow>('/api/admin/news', payload);
      router.push('/admin/news');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : getCompactErrorMessage(err, tCommon('saveFailed')),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('createTitle')}
        actions={
          <SecondaryButton onClick={() => router.back()}>
            {tCommon('cancel')}
          </SecondaryButton>
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {eventsError && (
            <AdminErrorAlert
              error={eventsError}
              fallbackMessage="Failed to load events list."
              retryLabel={tCommon('retry')}
              onRetry={() => refetchEvents()}
            />
          )}
          {error && (
            <InlineAlert variant="error">
              {error}
            </InlineAlert>
          )}

          <Field id="title" label={t('fields.title')} required>
            <TextInput
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
            />
          </Field>

          <Field id="slug" label={t('fields.slug')} required hint={t('slugHint')}>
            <TextInput
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              onBlur={() => setSlugTouched(true)}
              required
            />
          </Field>

          <Field id="body" label={t('fields.body')} required>
            <Textarea
              id="body"
              value={body}
              className="h-32"
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </Field>

          <Field id="eventId" label={t('fields.event')}>
            <Select
              id="eventId"
              value={eventId}
              onChange={setEventId}
              placeholder={t('fields.eventPlaceholder')}
              options={events.map((ev) => ({ value: ev.id, label: ev.name }))}
            />
          </Field>

          <Checkbox
            id="published"
            checked={published}
            onCheckedChange={setPublished}
            label={t('fields.published')}
          />

          <div className="flex gap-2 pt-2">
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => router.back()}>
              {tCommon('cancel')}
            </SecondaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
