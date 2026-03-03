import { type ReactNode } from 'react';

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      {action}
    </div>
  );
}
