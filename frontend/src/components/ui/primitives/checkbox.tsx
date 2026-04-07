'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface)] text-white shadow-sm outline-none transition',
      'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]',
      'data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)]',
      'data-[state=indeterminate]:border-[var(--color-primary)] data-[state=indeterminate]:bg-[var(--color-primary)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3.5 w-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
