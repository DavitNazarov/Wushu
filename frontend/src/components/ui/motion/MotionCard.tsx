'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { Variants, Transition, Target, VariantLabels } from 'framer-motion';
import { Card, type CardProps } from '@/components/ui/primitives/card';

type MotionCardProps = CardProps & {
  children: React.ReactNode;
  variants?: Variants;
  animate?: boolean | Target | VariantLabels;
  initial?: boolean | Target | VariantLabels;
  exit?: Target | VariantLabels;
  transition?: Transition;
  whileHover?: Target | VariantLabels;
  whileTap?: Target | VariantLabels;
};

/**
 * Motion-wrapped Card component for animated card entrance
 * Supports framer-motion animation props alongside card props.
 */
export function MotionCard({
  children,
  className,
  variants,
  animate,
  initial,
  exit,
  transition,
  whileHover,
  whileTap,
}: MotionCardProps) {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      variants={variants}
      transition={transition}
      whileHover={whileHover}
      whileTap={whileTap}
    >
      <Card className={className}>
        {children}
      </Card>
    </motion.div>
  );
}
