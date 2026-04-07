'use client';

import React from 'react';
import { motion, type MotionProps, type Variants } from 'framer-motion';
import { Modal, type ModalProps } from '@/components/ui/Modal';

interface MotionModalProps extends ModalProps, MotionProps {
  children: React.ReactNode;
  backdropVariants?: Variants;
  contentVariants?: Variants;
}

/**
 * Motion-wrapped Modal component for animated entrance/exit
 * Supports backdrop and content-specific animation variants
 */
export function MotionModal({
  children,
  open,
  backdropVariants,
  contentVariants,
  ...props
}: MotionModalProps) {
  if (!open) return null;

  const defaultBackdropVariants: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  };

  const defaultContentVariants: Variants = {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 100, opacity: 0 },
    transition: { duration: 0.3 },
  };

  return (
    <motion.div
      variants={backdropVariants || defaultBackdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        variants={contentVariants || defaultContentVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Modal open={open} {...props}>
          {children}
        </Modal>
      </motion.div>
    </motion.div>
  );
}
