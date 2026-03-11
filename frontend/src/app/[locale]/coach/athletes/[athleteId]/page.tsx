'use client';

import { use } from 'react';
import { AthleteProfilePage } from '@/components/athlete-profile/AthleteProfilePage';

type Props = {
  params: Promise<{ athleteId: string }>;
};

export default function CoachAthleteProfilePage({ params }: Props) {
  const { athleteId } = use(params);
  return <AthleteProfilePage athleteId={athleteId} scope="coach" />;
}
