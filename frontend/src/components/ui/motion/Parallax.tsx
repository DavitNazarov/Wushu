'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';

type ParallaxProps = {
  children: ReactNode;
  /**
   * Vertical travel in px across the element's full viewport pass.
   * Positive = drifts upward as it scrolls past (recedes, "further" depth).
   */
  offset?: number;
  className?: string;
};

/**
 * Scroll-linked parallax wrapper. The measuring container is never transformed
 * (avoids scroll-position feedback); the inner layer drifts vertically as the
 * element passes through the viewport. No-ops under prefers-reduced-motion.
 */
export function Parallax({ children, offset = 60, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  return (
    <div ref={ref} className={className}>
      <motion.div
        style={reduce ? undefined : { y }}
        className="relative h-full w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
