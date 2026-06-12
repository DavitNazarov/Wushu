import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import type { UserRole } from './capabilities';
import type { UserRole as DbUserRole } from '@prisma/client';

/** Handles user creation operations separated from session/JWT logic. */
@Injectable()
export class AuthUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async registerUser(params: {
    organisationId: string;
    actorUserId: string;
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
    clubId?: string | null;
    nationality?: string | null;
  }): Promise<{ id: string }> {
    const {
      organisationId,
      actorUserId,
      email,
      password,
      displayName,
      role,
      clubId,
      nationality,
    } = params;

    if (role === 'coach' && !clubId) throw new Error('COACH_CLUB_REQUIRED');
    if (role === 'admin' && clubId) throw new Error('ADMIN_CLUB_FORBIDDEN');
    if (role !== 'coach' && role !== 'admin' && clubId) {
      throw new Error('USER_ROLE_CLUB_INVALID');
    }

    // A coach inherits their club's region + country (denormalised copy).
    let regionId: string | null = null;
    let countryId: string | null = null;
    if (clubId) {
      const club = await this.prisma.club.findFirst({
        where: { id: clubId, organisationId },
        select: { id: true, regionId: true, countryId: true },
      });

      if (!club) throw new Error('INVALID_CLUB');
      regionId = club.regionId;
      countryId = club.countryId;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          organisationId,
          email: email.trim(),
          passwordHash,
          displayName: displayName.trim(),
          role: role as DbUserRole,
          clubId: clubId ?? null,
          regionId,
          countryId,
          nationality: nationality?.trim() || null,
          isActive: true,
        },
      });

      await this.audit.write({
        organisationId,
        actorUserId,
        action: 'USER_CREATED',
        entityType: 'user',
        entityId: user.id,
        before: null,
        after: {
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          clubId: user.clubId,
        },
        reason: null,
        ipAddress: null,
      });

      return { id: user.id };
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002')
        throw new Error('EMAIL_ALREADY_IN_USE');
      throw e;
    }
  }

  async bootstrapInitialAdmin(params: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ id: string; organisationId: string }> {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) throw new Error('BOOTSTRAP_ALREADY_COMPLETED');

    const org =
      (await this.prisma.organisation.findFirst()) ??
      (await this.prisma.organisation.create({
        data: { name: 'Default Organisation', slug: 'default' },
      }));

    const passwordHash = await bcrypt.hash(params.password, 12);

    const user = await this.prisma.user.create({
      data: {
        organisationId: org.id,
        email: params.email,
        passwordHash,
        displayName: params.displayName,
        role: 'admin',
        isActive: true,
      },
    });

    await this.audit.write({
      organisationId: org.id,
      actorUserId: null,
      action: 'INITIAL_ADMIN_BOOTSTRAP',
      entityType: 'user',
      entityId: user.id,
      before: null,
      after: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      reason: 'Initial admin bootstrap',
      ipAddress: null,
    });

    return { id: user.id, organisationId: org.id };
  }
}
