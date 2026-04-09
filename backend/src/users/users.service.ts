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

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authUser: AuthUserService,
  ) {}

  async list(organisationId: string): Promise<UserListRow[]> {
    const users = await this.prisma.user.findMany({
      where: { organisationId, role: { in: ['admin', 'coach'] } },
      select: userSelect,
      orderBy: [{ deletedAt: 'asc' }, { role: 'asc' }, { displayName: 'asc' }],
    });

    return users.map((user) => toListRow(user));
  }

  async getById(
    organisationId: string,
    userId: string,
  ): Promise<UserDetailRow> {
    const user = await this.findManagedUser(organisationId, userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    return toDetailRow(user);
  }

  async create(input: {
    organisationId: string;
    actorUserId: string;
    email: string;
    password: string;
    displayName: string;
    role: 'admin' | 'coach';
    clubId?: string | null;
  }): Promise<{ id: string }> {
    return this.authUser.registerUser(input);
  }

  async update(input: {
    organisationId: string;
    actorUserId: string;
    userId: string;
    email?: string;
    displayName?: string;
    role?: 'admin' | 'coach';
    clubId?: string | null;
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

  async getActivity(
    organisationId: string,
    userId: string,
  ): Promise<UserActivityEntry[]> {
    const user = await this.findManagedUser(organisationId, userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organisationId,
        OR: [
          { actorUserId: userId },
          { entityType: 'user', entityId: userId },
        ],
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

  private async findManagedUser(
    organisationId: string,
    userId: string,
  ): Promise<ManagedUserRecord | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, organisationId, role: { in: ['admin', 'coach'] } },
      select: userSelect,
    });
  }

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
