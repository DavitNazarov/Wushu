import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { getCapabilitiesForRole, type UserRole } from './capabilities';

export const JWT_COOKIE_NAME = 'gw_auth';
const JWT_EXPIRES_IN_SECONDS = 60 * 60 * 8;

export type AuthTokenPayload = {
  sub: string;
  organisationId: string;
  role: UserRole;
  capabilities: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set');
    return secret;
  }

  signToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: JWT_EXPIRES_IN_SECONDS,
    });
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      return jwt.verify(token, this.getJwtSecret()) as AuthTokenPayload;
    } catch {
      return null;
    }
  }

  async authenticate(
    email: string,
    password: string,
  ): Promise<
    | { ok: true; userId: string; organisationId: string; role: UserRole; token: string }
    | { ok: false; error: 'USER_DISABLED' | 'NO_ROLE' | 'INVALID_CREDENTIALS' }
  > {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        capabilities: { include: { capability: true } },
      },
    });

    if (!user) return { ok: false, error: 'INVALID_CREDENTIALS' };
    if (!user.isActive) return { ok: false, error: 'USER_DISABLED' };

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { ok: false, error: 'INVALID_CREDENTIALS' };

    const role = user.role;
    if (!role) return { ok: false, error: 'NO_ROLE' };

    const dbCapabilities = user.capabilities.map((uc) => uc.capability.code);
    const roleCapabilities = getCapabilitiesForRole(role as UserRole);
    const allCapabilities = [...new Set([...roleCapabilities, ...dbCapabilities])];

    const token = this.signToken({
      sub: user.id,
      organisationId: user.organisationId,
      role: role as UserRole,
      capabilities: allCapabilities,
    });

    return {
      ok: true,
      userId: user.id,
      organisationId: user.organisationId,
      role: role as UserRole,
      token,
    };
  }

  async logSignInAttempt(
    email: string,
    success: boolean,
    options?: { ipAddress?: string | null; userId?: string; organisationId?: string },
  ): Promise<void> {
    await this.audit.write({
      organisationId: options?.organisationId ?? '',
      actorUserId: options?.userId ?? null,
      action: success ? 'SIGN_IN_SUCCESS' : 'SIGN_IN_FAILURE',
      entityType: 'auth',
      entityId: email,
      before: null,
      after: { success },
      reason: null,
      ipAddress: options?.ipAddress ?? null,
    });
  }

  async registerUser(params: {
    organisationId: string;
    actorUserId: string;
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
  }): Promise<{ id: string }> {
    const { organisationId, actorUserId, email, password, displayName, role } = params;

    if (role === 'admin') {
      throw new Error('CANNOT_CREATE_ADMIN_VIA_API');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          organisationId,
          email,
          passwordHash,
          displayName,
          role,
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
    } catch (e: any) {
      if (e && typeof e === 'object' && e.code === 'P2002') {
        throw new Error('EMAIL_ALREADY_IN_USE');
      }
      throw e;
    }
  }

  async bootstrapInitialAdmin(params: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ id: string; organisationId: string }> {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new Error('BOOTSTRAP_ALREADY_COMPLETED');
    }

    const org =
      (await this.prisma.organisation.findFirst()) ??
      (await this.prisma.organisation.create({
        data: {
          name: 'Default Organisation',
          slug: 'default',
        },
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
