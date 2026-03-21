'use client';

import { use } from 'react';
import { ClubProfilePage } from '@/components/club-profile/ClubProfilePage';

type Props = {
  params: Promise<{ clubId: string }>;
};

export default function AdminClubProfilePage({ params }: Props) {
  const { clubId } = use(params);
  return <ClubProfilePage clubId={clubId} />;
}
