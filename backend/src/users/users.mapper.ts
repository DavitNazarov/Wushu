import type { Prisma } from '@prisma/client';
import { getUserAccountStatus, isUserDqActive } from './users.state';
import type { UserDetailRow, UserListRow } from './users.types';

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
