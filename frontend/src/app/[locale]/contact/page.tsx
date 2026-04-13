'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Send, Users } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ContactFormBlock } from '@/components/contact/ContactFormBlock';

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
          <Icon className="h-5 w-5" strokeWidth={1.8} />
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

export default function ContactPage() {
  const tPublic = useTranslations('public');

  return (
    <PublicLayout>
      <div className="space-y-16 pb-16">

        {/* Hero */}
        <section className="relative flex flex-col items-center py-16 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[360px] w-[360px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[90px]" />
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Get in touch
          </p>
          <h1 className="max-w-[540px] text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)]">
            {tPublic('contactTitle')}
          </h1>
          <p className="mt-4 max-w-[420px] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
            {tPublic('contactSubtitle')}
          </p>
        </section>

        {/* Two independent form panels */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* Contact / Send a message */}
          <FormPanel
            title={tPublic('contactFormTitle')}
            subtitle={tPublic('contactBody')}
            icon={Send}
            accent="#3b82f6"
            delay={0.05}
          >
            <ContactFormBlock
              formType="contact"
              accentColor="#3b82f6"
              submitLabel={tPublic('contactSubmit')}
              submittingLabel={tPublic('contactSubmitting')}
              successMessage={tPublic('contactSuccess')}
              errorMessage={tPublic('contactError')}
              fields={[
                { name: 'name',    label: tPublic('contactName'),    required: true },
                { name: 'email',   label: tPublic('contactEmail'),   type: 'email', required: true },
                { name: 'clubName',label: tPublic('contactClubName') },
                { name: 'message', label: tPublic('contactMessage'), required: true, textarea: true },
              ]}
            />
          </FormPanel>

          {/* Club membership interest */}
          <FormPanel
            title={tPublic('membershipTitle')}
            subtitle={tPublic('membershipSubtitle')}
            icon={Users}
            accent="#8b5cf6"
            delay={0.12}
          >
            <ContactFormBlock
              formType="membership"
              accentColor="#8b5cf6"
              submitLabel={tPublic('membershipSubmit')}
              submittingLabel={tPublic('membershipSubmitting')}
              successMessage={tPublic('membershipSuccess')}
              errorMessage={tPublic('contactError')}
              fields={[
                { name: 'clubName',label: tPublic('membershipClubName'), required: true },
                { name: 'name',    label: tPublic('contactName'),        required: true },
                { name: 'email',   label: tPublic('contactEmail'),       type: 'email', required: true },
                { name: 'message', label: tPublic('membershipNotes'),    required: true, textarea: true },
              ]}
            />
          </FormPanel>

        </div>
      </div>
    </PublicLayout>
  );
}
