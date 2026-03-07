/* Public contact + membership interest forms for P2-03 */
'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactPage() {
  const tPublic = useTranslations('public');

  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [clubName, setClubName] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot

  async function handleSubmit(event: FormEvent<HTMLFormElement>, type: 'contact' | 'membership') {
    event.preventDefault();
    setFormState('submitting');
    setError(null);

    try {
      const response = await fetch('/api/forms/contact', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          message,
          clubName: type === 'membership' ? clubName : (clubName || null),
          website: website || '',
          type,
        }),
      });

      if (!response.ok) {
        setFormState('error');
        return;
      }

      setFormState('success');
      setName('');
      setEmail('');
      setClubName('');
      setMessage('');
      setWebsite('');
    } catch {
      setFormState('error');
      setError(tPublic('contactError'));
    }
  }

  return (
    <PublicLayout>
      <div className="space-y-8 py-2">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {tPublic('contactTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('contactSubtitle')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
              {tPublic('contactFormTitle')}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {tPublic('contactBody')}
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                void handleSubmit(event, 'contact');
              }}
            >
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactEmail')}
                </label>
                <input
                  type="email"
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactClubName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactMessage')}
                </label>
                <textarea
                  className="h-28 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                />
              </div>
              <div className="hidden">
                <label>
                  Website
                  <input
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </label>
              </div>
              {formState === 'success' && (
                <InlineAlert variant="success">{tPublic('contactSuccess')}</InlineAlert>
              )}
              {formState === 'error' && (
                <InlineAlert variant="error">
                  {error ?? tPublic('contactError')}
                </InlineAlert>
              )}
              <button
                type="submit"
                disabled={formState === 'submitting'}
                className="mt-2 inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState === 'submitting' ? tPublic('contactSubmitting') : tPublic('contactSubmit')}
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
              {tPublic('membershipTitle')}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {tPublic('membershipSubtitle')}
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                void handleSubmit(event, 'membership');
              }}
            >
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('membershipClubName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactEmail')}
                </label>
                <input
                  type="email"
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="hidden" aria-hidden="true">
                <label>
                  Website
                  <input
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('membershipNotes')}
                </label>
                <textarea
                  className="h-28 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                />
              </div>
              {formState === 'success' && (
                <InlineAlert variant="success">{tPublic('membershipSuccess')}</InlineAlert>
              )}
              {formState === 'error' && (
                <InlineAlert variant="error">
                  {error ?? tPublic('contactError')}
                </InlineAlert>
              )}
              <button
                type="submit"
                disabled={formState === 'submitting'}
                className="mt-2 inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState === 'submitting'
                  ? tPublic('membershipSubmitting')
                  : tPublic('membershipSubmit')}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}


