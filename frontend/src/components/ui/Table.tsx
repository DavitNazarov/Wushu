import { type ReactNode } from 'react';

type TableProps = {
  children: ReactNode;
  className?: string;
};

export function Table({ children, className = '' }: TableProps) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] ${className}`}
    >
      <table className="min-w-full border-collapse text-[13px]">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-[var(--color-surface-alt)]">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[13px] font-medium text-[var(--color-text-muted)]">
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--color-border)]">{children}</tbody>;
}

export function TableRow({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      className={`bg-[var(--color-surface)] ${onClick ? 'cursor-pointer hover:bg-[var(--color-surface-alt)]' : ''}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <td
      className={`px-4 py-3 text-[var(--color-text)] ${muted ? 'text-[var(--color-text-muted)]' : ''}`}
    >
      {children}
    </td>
  );
}
