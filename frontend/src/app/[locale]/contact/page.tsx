/* Public contact + membership interest forms for P2-03 */
'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { publicVariants } from '@/lib/animations/variants';

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
        <motion.div
          initial="initial"
          animate="animate"
          variants={publicVariants.slideDown}
        >
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {tPublic('contactTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('contactSubtitle')}
          </p>
        </motion.div>

        <motion.div
          className="grid gap-6 md:grid-cols-2"
          variants={publicVariants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={publicVariants.staggerItem}>
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
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </motion.div>
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
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
              </motion.div>
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactClubName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                />
              </motion.div>
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactMessage')}
                </label>
                <textarea
                  className="h-28 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                />
              </motion.div>
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
                <motion.div variants={publicVariants.staggerItem}>
                  <InlineAlert variant="success">{tPublic('contactSuccess')}</InlineAlert>
                </motion.div>
              )}
              {formState === 'error' && (
                <motion.div variants={publicVariants.staggerItem}>
                  <InlineAlert variant="error">
                    {error ?? tPublic('contactError')}
                  </InlineAlert>
                </motion.div>
              )}
              <motion.button
                type="submit"
                disabled={formState === 'submitting'}
                className="mt-2 inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
                variants={publicVariants.staggerItem}
                whileHover={{ scale: 1.05, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
              >
                {formState === 'submitting' ? tPublic('contactSubmitting') : tPublic('contactSubmit')}
              </motion.button>
            </form>
            </Card>
          </motion.div>

          <motion.div variants={publicVariants.staggerItem}>
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
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('membershipClubName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  required
                />
              </motion.div>
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('contactName')}
                </label>
                <input
                  className="h-11 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </motion.div>
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
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
              </motion.div>
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
              <motion.div variants={publicVariants.staggerItem} className="space-y-1">
                <label className="block text-[12px] font-medium text-[var(--color-text)]">
                  {tPublic('membershipNotes')}
                </label>
                <textarea
                  className="h-28 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                />
              </motion.div>
              {formState === 'success' && (
                <motion.div variants={publicVariants.staggerItem}>
                  <InlineAlert variant="success">{tPublic('membershipSuccess')}</InlineAlert>
                </motion.div>
              )}
              {formState === 'error' && (
                <motion.div variants={publicVariants.staggerItem}>
                  <InlineAlert variant="error">
                    {error ?? tPublic('contactError')}
                  </InlineAlert>
                </motion.div>
              )}
              <motion.button
                type="submit"
                disabled={formState === 'submitting'}
                className="mt-2 inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
                variants={publicVariants.staggerItem}
                whileHover={{ scale: 1.05, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
              >
                {formState === 'submitting'
                  ? tPublic('membershipSubmitting')
                  : tPublic('membershipSubmit')}
              </motion.button>
            </form>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </PublicLayout>
  );
}


