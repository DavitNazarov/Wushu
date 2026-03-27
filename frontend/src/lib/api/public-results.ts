export type PublicResultPerson = {
  athleteId: string;
  fullName: string;
  clubName: string | null;
  corner: 'RED' | 'BLUE';
};

export type PublicResultPlacement = {
  rank: 1 | 2 | 3;
  athleteId: string;
  athleteName: string;
  clubName: string | null;
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

export type PublicResultRow = {
  id: string;
  status: 'COMPLETE' | 'CONFIRMED';
  stageCode: string;
  round: number;
  boutNo: number;
  scheduleOrder: number | null;
  matName: string | null;
  scheduledAt: string | null;
  method: 'POINTS' | 'KO' | 'DQ' | 'WO' | null;
  notes: string | null;
  winner: PublicResultPerson;
  opponent: PublicResultPerson;
};

export type PublicResultsCategory = {
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
  results: PublicResultRow[];
};

export type PublicResultsFeed = {
  eventId: string;
  categories: PublicResultsCategory[];
  clubs: PublicClubStanding[];
};
