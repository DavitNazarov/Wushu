'use client';

import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { InlineAlert } from '@/components/ui/InlineAlert';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const inputCls =
  'h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-[13px] text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';

const textareaCls =
  'h-32 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3 text-[13px] text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';

const labelCls = 'block text-[12px] font-semibold text-[var(--color-text)]';

export type ContactFormField = {
  name: 'name' | 'email' | 'clubName' | 'message';
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
};

type Props = {
  formType: 'contact' | 'membership';
  fields: ContactFormField[];
  submitLabel: string;
  submittingLabel: string;
  successMessage: string;
  errorMessage: string;
  accentColor: string;
};

export function ContactFormBlock({
  formType,
  fields,
  submitLabel,
  submittingLabel,
  successMessage,
  errorMessage,
  accentColor,
}: Props) {
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({
    name: '', email: '', clubName: '', message: '',
  });
  const [honeypot, setHoneypot] = useState('');

  const set = (field: string, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');
    setError(null);
    try {
      const res = await fetch('/api/forms/contact', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          message: values.message,
          clubName: values.clubName || null,
          website: honeypot || '',
          type: formType,
        }),
      });
      if (!res.ok) { setState('error'); return; }
      setState('success');
      setValues({ name: '', email: '', clubName: '', message: '' });
      setHoneypot('');
    } catch {
      setState('error');
      setError(errorMessage);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { void handleSubmit(e); }}>
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <label className={labelCls}>{field.label}</label>
          {field.textarea ? (
            <textarea
              className={textareaCls}
              value={values[field.name]}
              onChange={(e) => set(field.name, e.target.value)}
              required={field.required}
            />
          ) : (
            <input
              type={field.type ?? 'text'}
              className={inputCls}
              value={values[field.name]}
              onChange={(e) => set(field.name, e.target.value)}
              required={field.required}
            />
          )}
        </div>
      ))}

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      {state === 'success' && <InlineAlert variant="success">{successMessage}</InlineAlert>}
      {state === 'error' && <InlineAlert variant="error">{error ?? errorMessage}</InlineAlert>}

      <motion.button
        type="submit"
        disabled={state === 'submitting'}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{ background: accentColor }}
        className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'submitting' ? submittingLabel : submitLabel}
      </motion.button>
    </form>
  );
}
