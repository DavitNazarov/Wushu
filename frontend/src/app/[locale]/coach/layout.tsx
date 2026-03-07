import { ReactNode } from 'react';
import { requireRole } from '@/components/layout/RoleGuard';
import { ToastProvider } from '@/components/ui/Toast';
import { CoachShell } from '@/components/layout/CoachShell';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function CoachLayout({ children, params }: Props) {
  const { locale } = await params;
  await requireRole('coach', locale);
  return (
    <ToastProvider>
      <CoachShell>{children}</CoachShell>
    </ToastProvider>
  );
}
