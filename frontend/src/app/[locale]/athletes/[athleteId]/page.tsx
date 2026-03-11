'use client';

import { use } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AthleteProfilePage } from '@/components/athlete-profile/AthleteProfilePage';

type Props = {
  params: Promise<{ athleteId: string }>;
};

export default function PublicAthleteProfilePage({ params }: Props) {
  const { athleteId } = use(params);

  return (
    <PublicLayout>
      <AthleteProfilePage athleteId={athleteId} scope="public" />
    </PublicLayout>
  );
}
