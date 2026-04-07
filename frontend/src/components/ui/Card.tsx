import { type ReactNode } from 'react';
import { Card as PrimitiveCard } from '@/components/ui/primitives/card';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return (
    <PrimitiveCard className={`p-6 ${className}`}>
      {children}
    </PrimitiveCard>
  );
}
