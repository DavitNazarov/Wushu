import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUserService } from '../auth/auth-user.service';
import { isUserDqActive } from './users.state';
import type {
  UserActivityEntry,
  UserCapabilityRow,
  UserDetailRow,
  UserListRow,
} from './users.types';
import {
  auditSnapshot,
  type ManagedUserRecord,
  toDetailRow,
  toListRow,
  userSelect,
} from './users.mapper';
import { CAPABILITIES, getCapabilitiesForRole } from '../auth/capabilities';

// Admin-managed user CRUD + capability inspection. Only ever operates on
// users with role `admin` or `coach` — judges/timekeepers/athletes live
// outside the admin users UI and are managed elsewhere.
// Delegates new-user creation (with password hashing + email-uniqueness checks)
// to AuthUserService so login/registration code paths stay co-located.
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authUser: AuthUserService,
  ) {}

  // List admins + coaches for the admin users page. Ordered so live users
  // come before archived (deletedAt asc puts NULLs first depending on DB —
  // in Postgres NULLS LAST by default, but archived users are visually grouped).
  async list(organisationId: string): Promise<UserListRow[]> {
    const users = await this.prisma.user.findMany({
      where: { organisationId, role: { in: ['admin', 'coach'] } },
      select: userSelect,
      orderBy: [{ deletedAt: 'asc' }, { role: 'asc' }, { displayName: 'asc' }],
    });

    return users.map((user) => toListRow(user));
  }

  // Fetch a single admin/coach for the detail drawer. Throws USER_NOT_FOUND
  // if the id doesn't exist, isn't in this org, or isn't an admin/coach.
  async getById(
    organisationId: string,
    userId: string,
  ): Promise<UserDetailRow> {
    const user = await this.findManagedUser(organisationId, userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    return toDetailRow(user);
  }

  // Thin delegation to AuthUserService.registerUser, which handles password
  // hashing, EMAIL_ALREADY_IN_USE checks, and the audit row. We don't inline
  // that here so the same registration path is shared by the bootstrap-admin
  // and (future) coach self-signup flows.
  async create(input: {
    organisationId: string;
    actorUserId: string;
    email: string;
    password: string;
    displayName: string;
    role: 'admin' | 'coach';
    clubId?: string | null;
    nationality?: string | null;
  }): Promise<{ id: string }> {
    return this.authUser.registerUser(input);
  }

  // Partial update of an admin/coach. Two non-obvious behaviors:
  //   1. Promoting to admin forces clubId=null (admins don't belong to a club).
  //   2. role+clubId consistency is enforced via assertRoleClubRules BEFORE
  //      the write so we never end up with a coach without a club.
  // Wraps the update + audit log in a single transaction so partial failures
  // don't leave an orphan audit row.
  async update(input: {
    organisationId: string;
    actorUserId: string;
    userId: string;
    email?: string;
    displayName?: string;
    role?: 'admin' | 'coach';
    clubId?: string | null;
    nationality?: string | null;
    isActive?: boolean;
  }): Promise<UserDetailRow> {
    const existing = await this.findManagedUser(
      input.organisationId,
      input.userId,
    );
    if (!existing) throw new Error('USER_NOT_FOUND');
    if (existing.deletedAt) throw new Error('USER_ARCHIVED');

    const nextRole = (input.role ?? existing.role) as 'admin' | 'coach';
    const nextClubId =
      nextRole === 'admin'
        ? null
        : input.clubId !== undefined
          ? input.clubId
          : existing.clubId;

    await this.assertRoleClubRules(input.organisationId, nextRole, nextClubId);

    const data: Prisma.UserUncheckedUpdateInput = {
      email: input.email?.trim(),
      displayName: input.displayName?.trim(),
      role: nextRole,
      clubId: nextClubId,
      nationality:
        input.nationality !== undefined
          ? input.nationality?.trim() || null
          : undefined,
      isActive: input.isActive ?? existing.isActive,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data,
        select: userSelect,
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: 'USER_UPDATED',
          entityType: 'user',
          entityId: existing.id,
          before: auditSnapshot(existing),
          after: auditSnapshot(user),
          reason: null,
          ipAddress: null,
        },
        tx,
      );

      return user;
    });

    return toDetailRow(updated);
  }

  // Apply a fixed-window suspension (DQ) to a user. Guards:
  //   - Cannot suspend yourself (SELF_DQ_FORBIDDEN).
  //   - End must be after start AND in the future (INVALID_DQ_RANGE).
  //   - Cannot stack on top of an active suspension (USER_ALREADY_SUSPENDED).
  // Side effect: revokes every outstanding refresh token so the suspended user
  // is logged out of every device on next refresh.
  async suspend(input: {
    organisationId: string;
    actorUserId: string;
    userId: string;
    reason: string;
    startAt: Date;
    endAt: Date;
    note?: string | null;
  }): Promise<UserDetailRow> {
    if (input.userId === input.actorUserId)
      throw new Error('SELF_DQ_FORBIDDEN');
    if (input.endAt <= input.startAt || input.endAt <= new Date()) {
      throw new Error('INVALID_DQ_RANGE');
    }

    const existing = await this.findManagedUser(
      input.organisationId,
      input.userId,
    );
    if (!existing) throw new Error('USER_NOT_FOUND');
    if (existing.deletedAt) throw new Error('USER_ARCHIVED');
    if (isUserDqActive(existing)) throw new Error('USER_ALREADY_SUSPENDED');

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          dqReason: input.reason.trim(),
          dqStartAt: input.startAt,
          dqEndAt: input.endAt,
          dqNote: input.note?.trim() || null,
        },
        select: userSelect,
      });

      await tx.refreshToken.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: 'USER_SUSPENDED',
          entityType: 'user',
          entityId: existing.id,
          before: auditSnapshot(existing),
          after: auditSnapshot(user),
          reason: input.reason.trim(),
          ipAddress: null,
        },
        tx,
      );

      return user;
    });

    return toDetailRow(updated);
  }

  // Clear all four dq* fields. Throws USER_NOT_SUSPENDED if there's nothing to
  // clear (so admins get clear feedback rather than a silent no-op). Doesn't
  // re-issue tokens — the user can log in fresh next time.
  async removeSuspension(input: {
    organisationId: string;
    actorUserId: string;
    userId: string;
  }): Promise<UserDetailRow> {
    const existing = await this.findManagedUser(
      input.organisationId,
      input.userId,
    );
    if (!existing) throw new Error('USER_NOT_FOUND');
    if (existing.deletedAt) throw new Error('USER_ARCHIVED');
    if (!existing.dqReason && !existing.dqStartAt && !existing.dqEndAt) {
      throw new Error('USER_NOT_SUSPENDED');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          dqReason: null,
          dqStartAt: null,
          dqEndAt: null,
          dqNote: null,
        },
        select: userSelect,
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: 'USER_SUSPENSION_REMOVED',
          entityType: 'user',
          entityId: existing.id,
          before: auditSnapshot(existing),
          after: auditSnapshot(user),
          reason: null,
          ipAddress: null,
        },
        tx,
      );

      return user;
    });

    return toDetailRow(updated);
  }

  // Soft-archive: sets deletedAt + isActive=false and revokes all refresh
  // tokens. We don't hard-delete because Users are FK'd from audit logs,
  // events created, registrations approved, etc. Blocks self-archive
  // (SELF_DELETE_FORBIDDEN) to prevent admin lockouts.
  async archive(input: {
    organisationId: string;
    actorUserId: string;
    userId: string;
  }): Promise<UserDetailRow> {
    if (input.userId === input.actorUserId)
      throw new Error('SELF_DELETE_FORBIDDEN');

    const existing = await this.findManagedUser(
      input.organisationId,
      input.userId,
    );
    if (!existing) throw new Error('USER_NOT_FOUND');
    if (existing.deletedAt) throw new Error('USER_ARCHIVED');

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
        select: userSelect,
      });

      await tx.refreshToken.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: 'USER_ARCHIVED',
          entityType: 'user',
          entityId: existing.id,
          before: auditSnapshot(existing),
          after: auditSnapshot(user),
          reason: null,
          ipAddress: null,
        },
        tx,
      );

      return user;
    });

    return toDetailRow(updated);
  }

  // Recent audit-log entries (last 15) where this user was either the actor
  // or the target. Powers the "Activity" tab in the admin user detail drawer.
  // 15 is a UX number — enough context, fits without scrolling.
  async getActivity(
    organisationId: string,
    userId: string,
  ): Promise<UserActivityEntry[]> {
    const user = await this.findManagedUser(organisationId, userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organisationId,
        OR: [{ actorUserId: userId }, { entityType: 'user', entityId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorUserId: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    return logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  // Compute the user's effective capability set as rows the UI can render:
  //   - granted = true when either the role grants it OR a UserCapability row exists
  //   - isDefault = capability comes from the role (cannot be revoked individually)
  //   - isCustom  = capability was added on top of the role
  // Always returns one row per capability in CAPABILITIES so the UI can show
  // the full matrix with consistent ordering.
  async getCapabilities(
    organisationId: string,
    userId: string,
  ): Promise<UserCapabilityRow[]> {
    const user = await this.findManagedUser(organisationId, userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const customCaps = await this.prisma.userCapability.findMany({
      where: { userId },
      select: { capabilityId: true },
    });

    const defaultCaps = getCapabilitiesForRole(user.role);
    const customCapIds = new Set(customCaps.map((c) => c.capabilityId));
    const allCapabilities = Object.values(CAPABILITIES);

    return allCapabilities.map((code) => ({
      code,
      granted: defaultCaps.includes(code) || customCapIds.has(code),
      isDefault: defaultCaps.includes(code),
      isCustom: customCapIds.has(code) && !defaultCaps.includes(code),
    }));
  }

  // Internal lookup: same filter as list() but for a single row. Centralizes
  // the role-IN check so every mutation/read goes through identical scoping
  // (no risk of a method forgetting it and exposing judges/timekeepers
  // via the admin users API).
  private async findManagedUser(
    organisationId: string,
    userId: string,
  ): Promise<ManagedUserRecord | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, organisationId, role: { in: ['admin', 'coach'] } },
      select: userSelect,
    });
  }

  // Invariant enforcement for create/update paths:
  //   - coaches MUST have a club (they manage their club's athletes)
  //   - admins MUST NOT have a club (they're org-wide)
  //   - if a clubId is provided, it must actually exist in this org
  // Centralized so both create and update paths produce identical error codes.
  private async assertRoleClubRules(
    organisationId: string,
    role: 'admin' | 'coach',
    clubId: string | null | undefined,
  ): Promise<void> {
    if (role === 'coach' && !clubId) throw new Error('COACH_CLUB_REQUIRED');
    if (role === 'admin' && clubId) throw new Error('ADMIN_CLUB_FORBIDDEN');

    if (clubId) {
      const club = await this.prisma.club.findFirst({
        where: { id: clubId, organisationId },
        select: { id: true },
      });
      if (!club) throw new Error('INVALID_CLUB');
    }
  }
}
