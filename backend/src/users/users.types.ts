import type { UserRole } from '@prisma/client';
import type { UserAccountStatus } from './users.state';

export type UserListRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserAccountStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clubId: string | null;
  club: { id: string; name: string } | null;
};

export type UserDetailRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserAccountStatus;
  isActive: boolean;
  clubId: string | null;
  club: { id: string; name: string } | null;
  disciplinary: {
    isActive: boolean;
    reason: string | null;
    note: string | null;
    startAt: string | null;
    endAt: string | null;
  };
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type UserCapabilityRow = {
  code: string;
  granted: boolean;
  isDefault: boolean;
  isCustom: boolean;
};

export type AuthGuardValidationResult =
  | {
      ok: true;
      payload: {
        sub: string;
        organisationId: string;
        role: 'admin' | 'coach' | 'athlete' | 'judge' | 'timekeeper';
        capabilities: string[];
        clubId: string | null;
      };
    }
  | { ok: false; code: 'USER_DISABLED' | 'USER_ARCHIVED' | 'USER_SUSPENDED' };
