import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button } from '@/components/ui/primitives/button';

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function SecondaryButton({
  children,
  className = '',
  disabled,
  ...props
}: SecondaryButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      disabled={disabled}
      {...props}
    >
      {children}
    </Button>
  );
}
