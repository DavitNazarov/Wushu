import type { Variants } from 'framer-motion';

interface StaggerConfig {
  staggerDelay?: number;
  initialDelay?: number;
  isSpring?: boolean;
}

/**
 * Hook to generate stagger animation variants for children.
 * Useful for animating lists or grid items in sequence.
 */
export function useStaggerChildren(config: StaggerConfig = {}) {
  const {
    staggerDelay = 0.05,
    initialDelay = 0,
    isSpring = false,
  } = config;

  const container: Variants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
        ...(isSpring && { type: 'spring' as const }),
      },
    },
  };

  const item: Variants = {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      ...(isSpring && {
        transition: { type: 'spring', stiffness: 120 },
      }),
    },
  };

  return { container, item };
}
