'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/layout/PublicLayout';

const STEP_ACCENTS = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ec4899','#06b6d4','#f97316'];

export default function RulesPage() {
  const tPublic = useTranslations('public');

  const steps = [
    tPublic('rulesStep1'),
    tPublic('rulesStep2'),
    tPublic('rulesStep3'),
    tPublic('rulesStep4'),
    tPublic('rulesStep5'),
    tPublic('rulesStep6'),
    tPublic('rulesStep7'),
  ];

  return (
    <PublicLayout>
      <div className="space-y-16 pb-16">

        {/* hero */}
        <section className="relative flex flex-col items-center py-16 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[360px] w-[360px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[90px]" />
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            How it works
          </p>
          <h1 className="max-w-[560px] text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)]">
            {tPublic('rulesTitle')}
          </h1>
          <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
            {tPublic('rulesIntro')}
          </p>
        </section>

        {/* lifecycle steps */}
        <section>
          <div className="mb-8">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Lifecycle
            </p>
            <h2 className="text-[clamp(1.4rem,3vw,2rem)] font-bold tracking-tight text-[var(--color-text)]">
              {tPublic('rulesLifecycleTitle')}
            </h2>
            <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">{tPublic('rulesLifecycleIntro')}</p>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => {
              const accent = STEP_ACCENTS[i % STEP_ACCENTS.length];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.4 }}
                  className="flex items-start gap-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4"
                >
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-[0_0_0_4px]"
                    style={{ background: accent, boxShadow: `0 0 0 4px ${accent}22` }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{step}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* publishing concept */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-surface)] p-8"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-3xl" />
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Publishing
          </p>
          <h2 className="mb-3 text-[18px] font-bold text-[var(--color-text)]">
            {tPublic('rulesPublishingTitle')}
          </h2>
          <p className="text-[14px] leading-relaxed text-[var(--color-text-muted)]">
            {tPublic('rulesPublishingText')}
          </p>
        </motion.section>

      </div>
    </PublicLayout>
  );
}
