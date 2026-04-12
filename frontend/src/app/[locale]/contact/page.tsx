'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Send, Users } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { InlineAlert } from '@/components/ui/InlineAlert';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

/* ─── shared input style ────────────────────────────────────────────────── */
const inputCls =
  'h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-[13px] text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';

const textareaCls =
  'h-32 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3 text-[13px] text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';

const labelCls = 'block text-[12px] font-semibold text-[var(--color-text)]';

/* ─── form panel ─────────────────────────────────────────────────────────── */

function FormPanel({
  title,
  subtitle,
  icon: Icon,
  accent,
  children,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: accent }}
      />
      <div className="mb-6 flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}18`, color: accent }}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-[var(--color-text)]">{title}</h2>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export default function ContactPage() {
  const tPublic = useTranslations('public');

  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError]         = useState<string | null>(null);
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [clubName, setClubName]   = useState('');
  const [message, setMessage]     = useState('');
  const [website, setWebsite]     = useState(''); // honeypot

  async function handleSubmit(e: FormEvent<HTMLFormElement>, type: 'contact' | 'membership') {
    e.preventDefault();
    setFormState('submitting');
    setError(null);
    try {
      const res = await fetch('/api/forms/contact', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, clubName: clubName || null, website: website || '', type }),
      });
      if (!res.ok) { setFormState('error'); return; }
      setFormState('success');
      setName(''); setEmail(''); setClubName(''); setMessage(''); setWebsite('');
    } catch {
      setFormState('error');
      setError(tPublic('contactError'));
    }
  }

  return (
    <PublicLayout>
      <div className="space-y-16 pb-16">

        {/* hero */}
        <section className="relative flex flex-col items-center py-16 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[360px] w-[360px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[90px]" />
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Get in touch</p>
          <h1 className="max-w-[540px] text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)]">
            {tPublic('contactTitle')}
          </h1>
          <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
            {tPublic('contactSubtitle')}
          </p>
        </section>

        {/* two form panels */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* contact form */}
          <FormPanel title={tPublic('contactFormTitle')} subtitle={tPublic('contactBody')} icon={Send} accent="#3b82f6" delay={0.05}>
            <form className="space-y-4" onSubmit={(e) => { void handleSubmit(e, 'contact'); }}>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('contactName')}</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('contactEmail')}</label>
                <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('contactClubName')}</label>
                <input className={inputCls} value={clubName} onChange={(e) => setClubName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('contactMessage')}</label>
                <textarea className={textareaCls} value={message} onChange={(e) => setMessage(e.target.value)} required />
              </div>
              {/* honeypot */}
              <div className="hidden" aria-hidden="true">
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              {formState === 'success' && <InlineAlert variant="success">{tPublic('contactSuccess')}</InlineAlert>}
              {formState === 'error'   && <InlineAlert variant="error">{error ?? tPublic('contactError')}</InlineAlert>}
              <motion.button
                type="submit"
                disabled={formState === 'submitting'}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {formState === 'submitting' ? tPublic('contactSubmitting') : tPublic('contactSubmit')}
              </motion.button>
            </form>
          </FormPanel>

          {/* membership form */}
          <FormPanel title={tPublic('membershipTitle')} subtitle={tPublic('membershipSubtitle')} icon={Users} accent="#8b5cf6" delay={0.12}>
            <form className="space-y-4" onSubmit={(e) => { void handleSubmit(e, 'membership'); }}>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('membershipClubName')}</label>
                <input className={inputCls} value={clubName} onChange={(e) => setClubName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('contactName')}</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('contactEmail')}</label>
                <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>{tPublic('membershipNotes')}</label>
                <textarea className={textareaCls} value={message} onChange={(e) => setMessage(e.target.value)} required />
              </div>
              {/* honeypot */}
              <div className="hidden" aria-hidden="true">
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              {formState === 'success' && <InlineAlert variant="success">{tPublic('membershipSuccess')}</InlineAlert>}
              {formState === 'error'   && <InlineAlert variant="error">{error ?? tPublic('contactError')}</InlineAlert>}
              <motion.button
                type="submit"
                disabled={formState === 'submitting'}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--color-primary)] text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {formState === 'submitting' ? tPublic('membershipSubmitting') : tPublic('membershipSubmit')}
              </motion.button>
            </form>
          </FormPanel>

        </div>
      </div>
    </PublicLayout>
  );
}
