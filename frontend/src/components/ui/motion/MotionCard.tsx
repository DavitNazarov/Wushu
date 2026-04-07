'use client';

import React from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { Card, type CardProps } from '@/components/ui/primitives/card';

interface MotionCardProps extends CardProps, MotionProps {
  children: React.ReactNode;
  variants?: any;
  animate?: any;
  initial?: any;
}

/**
 * Motion-wrapped Card component for animated card entrance
 * Supports all motion and card props
 */
export function MotionCard({
  children,
  className,
  variants,
  animate,
  initial,
  ...props
}: MotionCardProps) {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      variants={variants}
      {...props}
    >
      <Card className={className}>
        {children}
      </Card>
    </motion.div>
  );
}
