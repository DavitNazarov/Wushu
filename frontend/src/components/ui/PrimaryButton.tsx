import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button } from '@/components/ui/primitives/button';

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PrimaryButton({ children, className = '', disabled, ...props }: PrimaryButtonProps) {
  return (
    <Button
      type="button"
      className={className}
      disabled={disabled}
      {...props}
    >
      {children}
    </Button>
  );
}
