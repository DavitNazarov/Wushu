'use client';

import {
  motion,
  useScroll,
  useSpring,
  useReducedMotion,
} from 'framer-motion';

/** Thin scroll-position bar pinned to the very top of the viewport. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[var(--color-primary)]"
    />
  );
}
