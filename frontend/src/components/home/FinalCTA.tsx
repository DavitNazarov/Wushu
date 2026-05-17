'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  motion,
  useScroll,
  useTransform,
  useVelocity,
  useSpring,
  useReducedMotion,
} from 'framer-motion';
import { ArrowRight, Globe } from 'lucide-react';

export function FinalCTA() {
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const reduce = useReducedMotion();

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smoothVel = useSpring(velocity, { damping: 50, stiffness: 300 });

  const glowY = useTransform(scrollYProgress, [0, 1], [-120, 120]);
  const glowScale = useTransform(smoothVel, [-2500, 0, 2500], [1.35, 1, 1.35], {
    clamp: true,
  });
  const headlineY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden"
      style={{ background: 'var(--color-primary)' }}
    >
      {/* velocity-reactive glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-[120px]"
        style={
          reduce
            ? { opacity: 0.08 }
            : { opacity: 0.1, y: glowY, scale: glowScale }
        }
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 20px)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />

      <motion.div
        style={reduce ? undefined : { y: headlineY }}
        className="relative mx-auto max-w-[900px] px-6 py-32 text-center text-white md:py-40"
      >
        <div className="mb-6 flex items-center justify-center gap-2 opacity-60">
          <Globe className="h-4 w-4" />
          <span className="text-[11px] font-bold uppercase tracking-[0.28em]">
            {tPublic('ctaEyebrow')}
          </span>
        </div>
        <h2 className="text-[clamp(2.4rem,7vw,5.5rem)] font-black leading-[0.95] tracking-[-0.02em]">
          {tPublic('ctaTitle')}
        </h2>
        <p className="mx-auto mt-7 max-w-[520px] text-[16px] leading-relaxed opacity-75 sm:text-[18px]">
          {tPublic('ctaSubtitle')}
        </p>
        <Link href={`/${locale}/events`}>
          <motion.span
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="group relative mt-12 inline-flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-full bg-white px-10 py-5 text-[15px] font-bold text-[var(--color-primary)] shadow-2xl"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--color-primary)]/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">{tPublic('viewEvents')}</span>
            <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </motion.span>
        </Link>
      </motion.div>
    </section>
  );
}
