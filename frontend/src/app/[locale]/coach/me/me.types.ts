export type AuthContext = {
  userId: string | null;
  organisationId: string | null;
  role: string;
  clubId?: string | null;
  displayName?: string | null;
  clubName?: string | null;
  organisationName?: string | null;
};
