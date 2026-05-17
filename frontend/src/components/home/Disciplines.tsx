'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Wind, Flame, Users, Swords, type LucideIcon } from 'lucide-react';
import { Parallax } from '@/components/ui/motion/Parallax';

type Discipline = {
  icon: LucideIcon;
  name: string;
  tag: string;
  desc: string;
};

function DisciplineCard({
  d,
  index,
}: {
  d: Discipline;
  index: number;
}) {
  const Icon = d.icon;
  // alternating depth so the cards drift at different rates as you scroll
  const offset = index % 2 === 0 ? 46 : -46;

  return (
    <Parallax offset={offset} className="h-full">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{
          delay: index * 0.08,
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors duration-300 hover:border-[var(--color-primary)]/40 sm:p-9"
      >
        {/* ghost index */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-6 select-none text-[8rem] font-black leading-none tracking-tighter text-[var(--color-text)] opacity-[0.035]"
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* hover glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: 'var(--color-primary)', opacity: 0 }}
        />

        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)] transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-105">
          <Icon className="h-7 w-7" strokeWidth={1.7} />
        </div>

        <div className="relative mt-7">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-primary)]">
            {d.tag}
          </span>
          <h3 className="mt-2 text-[clamp(1.6rem,2.6vw,2.4rem)] font-black tracking-tight text-[var(--color-text)]">
            {d.name}
          </h3>
        </div>

        {/* description reveals on hover (CSS-only) */}
        <div className="relative mt-4 grid grid-rows-[0fr] opacity-0 transition-all duration-500 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100 motion-reduce:grid-rows-[1fr] motion-reduce:opacity-100">
          <p className="overflow-hidden text-[14px] leading-relaxed text-[var(--color-text-muted)]">
            {d.desc}
          </p>
        </div>

        <div className="relative mt-auto pt-7">
          <div className="h-px w-full bg-[var(--color-border)]">
            <div className="h-px w-0 bg-[var(--color-primary)] transition-all duration-700 ease-out group-hover:w-full" />
          </div>
        </div>
      </motion.div>
    </Parallax>
  );
}

export function Disciplines() {
  const tPublic = useTranslations('public');

  const disciplines: Discipline[] = [
    {
      icon: Wind,
      name: tPublic('disciplineTaoluName'),
      tag: tPublic('disciplineTaoluTag'),
      desc: tPublic('disciplineTaoluDesc'),
    },
    {
      icon: Flame,
      name: tPublic('disciplineSandaName'),
      tag: tPublic('disciplineSandaTag'),
      desc: tPublic('disciplineSandaDesc'),
    },
    {
      icon: Users,
      name: tPublic('disciplineDuilianName'),
      tag: tPublic('disciplineDuilianTag'),
      desc: tPublic('disciplineDuilianDesc'),
    },
    {
      icon: Swords,
      name: tPublic('disciplineWeaponsName'),
      tag: tPublic('disciplineWeaponsTag'),
      desc: tPublic('disciplineWeaponsDesc'),
    },
  ];

  return (
    <section className="relative mx-auto max-w-[1200px] px-4 py-28 md:px-6 md:py-36">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-16 max-w-[640px]"
      >
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.34em] text-[var(--color-primary)]">
          {tPublic('disciplinesEyebrow')}
        </p>
        <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-tight text-[var(--color-text)]">
          {tPublic('disciplinesTitle')}
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-text-muted)] sm:text-[16px]">
          {tPublic('disciplinesSubtitle')}
        </p>
      </motion.div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {disciplines.map((d, i) => (
          <DisciplineCard key={d.name} d={d} index={i} />
        ))}
      </div>
    </section>
  );
}
