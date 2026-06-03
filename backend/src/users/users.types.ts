import type { UserRole } from '@prisma/client';
import type { UserAccountStatus } from './users.state';

// JSON contract for one row in GET /admin/users. Dates are ISO strings (not
// Date instances) since this type is meant to mirror what crosses the wire.
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
  nationality: string | null;
  club: { id: string; name: string } | null;
};

// JSON contract for GET /admin/users/:id. Adds the nested `disciplinary`
// summary and the archive timestamp on top of the list shape.
export type UserDetailRow = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserAccountStatus;
  isActive: boolean;
  clubId: string | null;
  nationality: string | null;
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

// One row in GET /admin/users/:id/activity — slim projection of AuditLog.
export type UserActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  ipAddress: string | null;
  createdAt: string;
};

// One row in GET /admin/users/:id/capabilities. Two booleans (isDefault +
// isCustom) instead of a single source enum so the UI can show both states
// independently (e.g. "granted by role, NOT customizable").
export type UserCapabilityRow = {
  code: string;
  granted: boolean;
  isDefault: boolean;
  isCustom: boolean;
};

// Discriminated union returned by the AuthGuard when it validates a token
// + DB lookup. On success carries the decoded JWT payload; on failure carries
// a typed reason so the guard can map it to the correct 401/403 response.
// Lives here (not in auth/) because UsersService shares the underlying state
// rules that drive these failure codes.
export type AuthGuardValidationResult =
  | {
      ok: true;
      payload: {
        sub: string;
        organisationId: string;
        role: 'admin' | 'coach' | 'athlete' | 'judge' | 'timekeeper';
        capabilities: string[];
        clubId: string | null;
        type: 'access' | 'refresh';
      };
    }
  | { ok: false; code: 'USER_DISABLED' | 'USER_ARCHIVED' | 'USER_SUSPENDED' };
