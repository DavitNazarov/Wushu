'use client';

import { ReactNode } from 'react';
import { Header } from './Header';

type PublicLayoutProps = {
  children: ReactNode;
};

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
