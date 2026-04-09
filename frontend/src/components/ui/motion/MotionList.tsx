'use client';

import React from 'react';
import { motion, type MotionProps, type Variants } from 'framer-motion';

interface MotionListProps extends MotionProps {
  children: React.ReactNode;
  containerVariants?: Variants;
  itemVariants?: Variants;
  as?: React.ElementType;
}

/**
 * Motion-wrapped list container for staggered item animations
 * Use with containerVariants and itemVariants for coordinated animations
 */
export function MotionList({
  children,
  containerVariants,
  itemVariants,
  as = 'div',
  ...props
}: MotionListProps) {
  const MotionComponent = motion[as as keyof typeof motion] as any;

  return (
    <MotionComponent
      variants={containerVariants}
      initial="initial"
      animate="animate"
      {...props}
    >
      {children}
    </MotionComponent>
  );
}

interface MotionListItemProps extends MotionProps {
  children: React.ReactNode;
  itemVariants?: Variants;
  as?: React.ElementType;
}

/**
 * Motion-wrapped list item for individual item animations
 * Use with containerVariants that has staggerChildren
 */
export function MotionListItem({
  children,
  itemVariants,
  as = 'div',
  ...props
}: MotionListItemProps) {
  const MotionComponent = motion[as as keyof typeof motion] as any;

  return (
    <MotionComponent
      variants={itemVariants}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}
