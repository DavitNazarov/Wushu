'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  const [internalChecked, setInternalChecked] =
    React.useState<CheckboxPrimitive.CheckedState>(
      checked ?? defaultChecked ?? false,
    );

  // Sync controlled value
  React.useEffect(() => {
    if (checked !== undefined) setInternalChecked(checked);
  }, [checked]);

  const isChecked = internalChecked === true || internalChecked === 'indeterminate';

  function handleCheckedChange(val: CheckboxPrimitive.CheckedState) {
    if (checked === undefined) setInternalChecked(val);
    onCheckedChange?.(val);
  }

  return (
    <motion.span
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      style={{ display: 'inline-flex' }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <CheckboxPrimitive.Root
        ref={ref}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={handleCheckedChange}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface)] text-white shadow-sm outline-none transition-colors duration-200',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]',
          'data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)]',
          'data-[state=indeterminate]:border-[var(--color-primary)] data-[state=indeterminate]:bg-[var(--color-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator forceMount asChild>
          <span className="flex items-center justify-center">
            <AnimatePresence initial={false}>
              {isChecked && (
                <motion.svg
                  key="check"
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="8"
                  viewBox="0 0 10 8"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  <motion.path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    exit={{ pathLength: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  />
                </motion.svg>
              )}
            </AnimatePresence>
          </span>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </motion.span>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
