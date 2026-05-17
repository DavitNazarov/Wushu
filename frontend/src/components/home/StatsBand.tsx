'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Parallax } from '@/components/ui/motion/Parallax';

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !seen) setSeen(true);
      },
      { threshold: 0.4 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    const duration = 1600;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [seen, value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

function Stat({
  value,
  suffix,
  label,
  idx,
}: {
  value: number;
  suffix?: string;
  label: string;
  idx: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="text-center"
    >
      <p className="text-[clamp(2.8rem,7vw,5rem)] font-black tabular-nums leading-none text-white">
        <CountUp value={value} suffix={suffix} />
      </p>
      <div className="mx-auto mt-5 h-px w-10 bg-white/20" />
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
        {label}
      </p>
    </motion.div>
  );
}

export function StatsBand() {
  const tPublic = useTranslations('public');

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'var(--color-inverse-surface)' }}
    >
      <Parallax offset={70} className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -inset-y-32 inset-x-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 24px)',
          }}
        />
      </Parallax>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
          opacity: 0.4,
        }}
      />

      <div className="relative mx-auto max-w-[1100px] px-6 py-24 md:py-28">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <Stat idx={0} value={12} suffix="+" label={tPublic('statTournaments')} />
          <Stat idx={1} value={600} suffix="+" label={tPublic('statAthletes')} />
          <Stat idx={2} value={40} suffix="+" label={tPublic('statClubs')} />
          <Stat idx={3} value={2000} suffix="+" label={tPublic('statFights')} />
        </div>
      </div>
    </section>
  );
}
