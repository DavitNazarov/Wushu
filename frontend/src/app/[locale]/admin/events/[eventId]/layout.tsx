import { ReactNode } from 'react';
import { AdminEventScopeLayout } from '@/features/admin-events/components/AdminEventScopeLayout';

type Props = {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventLayout({ children, params }: Props) {
  const { eventId } = await params;

  return <AdminEventScopeLayout eventId={eventId}>{children}</AdminEventScopeLayout>;
}
