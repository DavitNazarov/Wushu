import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex appearance-none items-center justify-center rounded-[var(--radius-input)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-primary)] text-white shadow-sm hover:bg-[var(--color-primary-hover)]',
        secondary:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]',
        ghost:
          'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]',
      },
      size: {
        default: 'h-11 px-4 text-sm font-medium',
        sm: 'h-9 px-3 text-sm font-medium',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  asChild = false,
  className,
  size,
  type,
  variant,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
}

export { buttonVariants };
