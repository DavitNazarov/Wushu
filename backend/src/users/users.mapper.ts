import type { Prisma } from '@prisma/client';
import { getUserAccountStatus, isUserDqActive } from './users.state';
import type { UserDetailRow, UserListRow } from './users.types';

// The shape returned by every Prisma read in UsersService — built from
// `userSelect` below. Kept as a hand-written type rather than Prisma-inferred
// because it crosses module boundaries (audit snapshots, list/detail mappers).
export type ManagedUserRecord = {
  id: string;
  organisationId: string;
  email: string;
  displayName: string;
  role: 'admin' | 'coach' | 'athlete' | 'judge' | 'timekeeper';
  clubId: string | null;
  nationality: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  dqReason: string | null;
  dqStartAt: Date | null;
  dqEndAt: Date | null;
  dqNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  club: { id: string; name: string } | null;
};

// Canonical Prisma `select` block reused by every UsersService query.
// `satisfies Prisma.UserSelect` keeps the type narrow while still letting
// Prisma's generated typings drive the resulting row shape. Changing this
// block changes the shape of ManagedUserRecord everywhere — be intentional.
export const userSelect = {
  id: true,
  organisationId: true,
  email: true,
  displayName: true,
  role: true,
  clubId: true,
  nationality: true,
  isActive: true,
  deletedAt: true,
  dqReason: true,
  dqStartAt: true,
  dqEndAt: true,
  dqNote: true,
  createdAt: true,
  updatedAt: true,
  club: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserSelect;

// Map a DB row to the index-page row shape. Adds a computed `status`
// (active / dq'd / archived) and serializes Date instances to ISO strings
// so the JSON response is stable across timezones.
export function toListRow(user: ManagedUserRecord): UserListRow {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: getUserAccountStatus(user),
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    clubId: user.clubId,
    nationality: user.nationality,
    club: user.club,
  };
}

// Map a DB row to the detail-drawer row shape. Same as toListRow plus a
// nested `disciplinary` object so the drawer can show the active DQ window
// without re-deriving it on the client. role is cast to admin|coach because
// the rest of the codebase guarantees we only operate on those two values.
export function toDetailRow(user: ManagedUserRecord): UserDetailRow {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as 'admin' | 'coach',
    status: getUserAccountStatus(user),
    isActive: user.isActive,
    clubId: user.clubId,
    nationality: user.nationality,
    club: user.club,
    disciplinary: {
      isActive: isUserDqActive(user),
      reason: user.dqReason,
      note: user.dqNote,
      startAt: user.dqStartAt?.toISOString() ?? null,
      endAt: user.dqEndAt?.toISOString() ?? null,
    },
    deletedAt: user.deletedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// Stable, JSON-safe snapshot used as the `before`/`after` payload on every
// USER_* audit log row. Intentionally drops id/createdAt/updatedAt and the
// club join — we want the diffable fields, not noise from auto-managed cols.
export function auditSnapshot(user: ManagedUserRecord) {
  return {
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    clubId: user.clubId,
    isActive: user.isActive,
    deletedAt: user.deletedAt?.toISOString() ?? null,
    dqReason: user.dqReason,
    dqStartAt: user.dqStartAt?.toISOString() ?? null,
    dqEndAt: user.dqEndAt?.toISOString() ?? null,
    dqNote: user.dqNote,
  };
}
