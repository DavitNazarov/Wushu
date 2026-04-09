'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Modal, type ModalProps } from '@/components/ui/Modal';

type MotionModalProps = ModalProps & {
  backdropVariants?: Variants;
  contentVariants?: Variants;
};

const defaultBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const defaultContentVariants: Variants = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.3 } },
  exit: { x: 100, opacity: 0, transition: { duration: 0.3 } },
};

/**
 * Motion-wrapped Modal component for animated entrance/exit.
 * Pass backdropVariants / contentVariants to customise animations.
 */
export function MotionModal({
  children,
  open,
  backdropVariants,
  contentVariants,
  ...modalProps
}: MotionModalProps) {
  if (!open) return null;

  return (
    <motion.div
      variants={backdropVariants ?? defaultBackdropVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        variants={contentVariants ?? defaultContentVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Modal open={open} {...modalProps}>
          {children}
        </Modal>
      </motion.div>
    </motion.div>
  );
}
