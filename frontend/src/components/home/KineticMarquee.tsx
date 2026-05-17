'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  motion,
  useScroll,
  useVelocity,
  useSpring,
  useTransform,
  useMotionValue,
  useAnimationFrame,
  useReducedMotion,
} from 'framer-motion';

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

export function KineticMarquee() {
  const tPublic = useTranslations('public');
  const reduce = useReducedMotion();
  const phrase = tPublic('heroBadge');

  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 4], {
    clamp: false,
  });
  const direction = useRef(1);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    let moveBy = direction.current * 1.6 * (delta / 1000);
    const v = velocityFactor.get();
    if (v < 0) direction.current = -1;
    else if (v > 0) direction.current = 1;
    moveBy += direction.current * moveBy * v;
    baseX.set(baseX.get() + moveBy);
  });

  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);
  const skew = useTransform(smoothVelocity, [-2000, 0, 2000], [-6, 0, 6], {
    clamp: true,
  });

  const Row = () => (
    <div className="flex shrink-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="flex items-center">
          <span className="px-8 text-[clamp(2.2rem,7vw,5.5rem)] font-black uppercase tracking-tight text-white/90">
            {phrase}
          </span>
          <span
            className="text-[clamp(1.4rem,4vw,3rem)] text-[var(--color-primary)]"
            aria-hidden
          >
            ◆
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <section
      aria-hidden
      className="relative flex items-center overflow-hidden py-12"
      style={{ background: 'var(--color-inverse-surface)' }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32"
        style={{ background: 'linear-gradient(to right, var(--color-inverse-surface), transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32"
        style={{ background: 'linear-gradient(to left, var(--color-inverse-surface), transparent)' }}
      />
      {reduce ? (
        <div className="flex w-full justify-center">
          <span className="px-8 text-[clamp(2rem,6vw,4.5rem)] font-black uppercase tracking-tight text-white/90">
            {phrase}
          </span>
        </div>
      ) : (
        <motion.div className="flex whitespace-nowrap" style={{ x, skewX: skew }}>
          <Row />
          <Row />
        </motion.div>
      )}
    </section>
  );
}
