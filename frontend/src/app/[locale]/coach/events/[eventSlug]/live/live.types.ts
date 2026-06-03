export type AthleteSlot = {
  firstName: string;
  firstNameKa?: string | null;
  lastName: string;
  lastNameKa?: string | null;
};

export type MatFightSlot = {
  id: string;
  redAthlete?: AthleteSlot;
  blueAthlete?: AthleteSlot;
  status?: string;
};

export type MatFeed = {
  mat: { id: string; name: string };
  now: MatFightSlot | null;
  onDeck: MatFightSlot | null;
  next: MatFightSlot[];
};
