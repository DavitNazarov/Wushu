// Pure helpers for deriving the visible account state from raw User columns.
// Kept separate so guards (and the AuthGuard cookie-refresh logic) can call
// them without pulling in the whole UsersService dependency graph.

// Minimal subset of User columns needed to decide the displayed status.
// Lets callers pass a Prisma User OR a hand-rolled object (handy in tests).
type AccountStateFields = {
  isActive: boolean;
  deletedAt: Date | null;
  dqStartAt: Date | null;
  dqEndAt: Date | null;
};

// Order matches the priority used by getUserAccountStatus below.
export type UserAccountStatus = 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE';

// True iff `now` falls inside the user's disciplinary window AND they are
// not archived. `now` is injected so tests can pin a deterministic clock
// without monkey-patching Date.
export function isUserDqActive(
  user: Pick<AccountStateFields, 'deletedAt' | 'dqStartAt' | 'dqEndAt'>,
  now = new Date(),
): boolean {
  if (user.deletedAt || !user.dqStartAt || !user.dqEndAt) return false;
  return user.dqStartAt <= now && user.dqEndAt >= now;
}

// Single source of truth for the status pill shown in the admin users UI.
// Priority order is intentional: archived hides everything else, an active
// DQ outranks the isActive flag, then we fall back to active/inactive.
export function getUserAccountStatus(
  user: AccountStateFields,
  now = new Date(),
): UserAccountStatus {
  if (user.deletedAt) return 'ARCHIVED';
  if (isUserDqActive(user, now)) return 'DQ';
  if (!user.isActive) return 'INACTIVE';
  return 'ACTIVE';
}
