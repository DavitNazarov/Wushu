import * as React from 'react';
import { cn } from '@/lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]',
        className,
      )}
      {...props}
    />
  );
}
