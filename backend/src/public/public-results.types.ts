import type { WinMethod } from '@prisma/client';

export type PublicResultPerson = {
  athleteId: string;
  fullName: string;
  fullNameKa: string | null;
  clubName: string | null;
  clubNameKa: string | null;
  corner: 'RED' | 'BLUE';
};

export type PublicResultPlacement = {
  rank: 1 | 2 | 3;
  athleteId: string;
  athleteName: string;
  athleteNameKa: string | null;
  clubName: string | null;
  clubNameKa: string | null;
  medal: 'GOLD' | 'SILVER' | 'BRONZE';
};

export type PublicClubStanding = {
  clubId: string | null;
  clubName: string | null;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
};

export type PublicResultFight = {
  id: string;
  status: 'COMPLETE' | 'CONFIRMED';
  stageCode: string;
  round: number;
  boutNo: number;
  scheduleOrder: number | null;
  matName: string | null;
  scheduledAt: Date | null;
  method: WinMethod | null;
  notes: string | null;
  winner: PublicResultPerson;
  opponent: PublicResultPerson;
};

export type PublicResultCategory = {
  categoryCode: string;
  categoryName: string;
  ageGroupName: string | null;
  resultCount: number;
  placements: {
    isAvailable: boolean;
    first: PublicResultPlacement | null;
    second: PublicResultPlacement | null;
    third: PublicResultPlacement[];
  };
  results: PublicResultFight[];
};

export function fullName(
  input:
    | {
        firstName: string;
        lastName: string;
      }
    | null
    | undefined,
): string {
  if (!input) return 'TBD';
  return `${input.firstName} ${input.lastName}`;
}

export function fullNameKa(
  input:
    | {
        firstNameKa?: string | null;
        lastNameKa?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!input?.firstNameKa || !input?.lastNameKa) return null;
  return `${input.firstNameKa} ${input.lastNameKa}`;
}

export function bucketKey(fight: {
  bracketId: string | null;
  eventWeightCategoryId: string | null;
  categoryCode: string;
  id: string;
}): string {
  return (
    fight.bracketId ??
    fight.eventWeightCategoryId ??
    fight.categoryCode ??
    fight.id
  );
}
