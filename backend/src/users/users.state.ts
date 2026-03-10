type AccountStateFields = {
  isActive: boolean;
  deletedAt: Date | null;
  dqStartAt: Date | null;
  dqEndAt: Date | null;
};

export type UserAccountStatus = 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE';

export function isUserDqActive(
  user: Pick<AccountStateFields, 'deletedAt' | 'dqStartAt' | 'dqEndAt'>,
  now = new Date(),
): boolean {
  if (user.deletedAt || !user.dqStartAt || !user.dqEndAt) return false;
  return user.dqStartAt <= now && user.dqEndAt >= now;
}

export function getUserAccountStatus(
  user: AccountStateFields,
  now = new Date(),
): UserAccountStatus {
  if (user.deletedAt) return 'ARCHIVED';
  if (isUserDqActive(user, now)) return 'DQ';
  if (!user.isActive) return 'INACTIVE';
  return 'ACTIVE';
}
