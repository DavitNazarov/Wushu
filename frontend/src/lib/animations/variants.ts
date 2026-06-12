import type { Variants } from 'framer-motion';

/**
 * Admin page animations - subtle, professional, <300ms
 */
export const adminVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.25 },
  } as Variants,

  slideUp: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.3 },
  } as Variants,

  slideDown: {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.3 },
  } as Variants,

  scale: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.3 },
  } as Variants,

  staggerContainer: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0,
      },
    },
  } as Variants,

  staggerChild: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  } as Variants,

  hover: {
    scale: 1.02,
    transition: { duration: 0.15 },
  },

  hoverColor: {
    transition: { duration: 0.15 },
  },
};

/**
 * Public page animations - playful, engaging, spring physics
 */
export const publicVariants = {
  slideDown: {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { type: 'spring', stiffness: 100, damping: 20 },
  } as Variants,

  popIn: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', stiffness: 150, damping: 25 },
  } as Variants,

  bounce: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 200, damping: 15 } },
    whileHover: { scale: 1.05, transition: { type: 'spring', stiffness: 300, damping: 20 } },
  } as Variants,

  slideUp: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { type: 'spring', stiffness: 100, damping: 20 },
  } as Variants,

  staggerContainer: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0,
      },
    },
  } as Variants,

  staggerItem: {
    initial: { opacity: 0, scale: 0.9, y: 8 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 120, damping: 20 },
    },
  } as Variants,

  hover: {
    scale: 1.05,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },

  tap: {
    scale: 0.95,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

