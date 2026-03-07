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
  }): Promise<{ id: string }> {
    const { organisationId, actorUserId, email, password, displayName, role } =
      params;

    if (role === 'admin') throw new Error('CANNOT_CREATE_ADMIN_VIA_API');

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          organisationId,
          email,
          passwordHash,
          displayName,
          role: role as DbUserRole,
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

    const passwordHash = await bcrypt.hash(params.password, 10);

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
