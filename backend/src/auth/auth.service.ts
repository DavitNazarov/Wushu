import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { getCapabilitiesForRole, type UserRole } from './capabilities';

export const JWT_COOKIE_NAME = 'gw_auth';
export const REFRESH_COOKIE_NAME = 'gw_refresh';

// JWT lifetimes (seconds) — used for jwt.sign expiresIn
const ACCESS_EXPIRES_IN_SECONDS = 15 * 60; // 15 min
const REFRESH_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Cookie maxAge (milliseconds) — Express res.cookie() takes milliseconds
// Express converts to seconds before writing the Max-Age header (divides by 1000).
// Using wrong units here causes Max-Age:0 which makes the browser delete the cookie immediately.
export const ACCESS_COOKIE_MAX_AGE_MS = ACCESS_EXPIRES_IN_SECONDS * 1000; // 900 000 ms → Max-Age: 900
export const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_EXPIRES_IN_SECONDS * 1000; // 604 800 000 ms → Max-Age: 604800

export type AuthTokenPayload = {
  sub: string;
  organisationId: string;
  role: UserRole;
  capabilities: string[];
  clubId?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
      expiresIn: ACCESS_EXPIRES_IN_SECONDS,
    });
  }

  signRefreshToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: REFRESH_EXPIRES_IN_SECONDS,
    });
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      return jwt.verify(token, this.getJwtSecret()) as AuthTokenPayload;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): AuthTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret()) as jwt.JwtPayload &
        AuthTokenPayload;
      if (
        typeof decoded.sub !== 'string' ||
        typeof decoded.organisationId !== 'string' ||
        typeof decoded.role !== 'string' ||
        !Array.isArray(decoded.capabilities)
      ) {
        return null;
      }
      return {
        sub: decoded.sub,
        organisationId: decoded.organisationId,
        role: decoded.role,
        capabilities: decoded.capabilities,
        clubId: decoded.clubId ?? null,
      };
    } catch {
      return null;
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isRefreshTokenStorageUnavailableError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    );
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_SECONDS * 1000);
    try {
      await this.prisma.refreshToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    } catch (error) {
      if (this.isRefreshTokenStorageUnavailableError(error)) {
        this.logger.warn(
          '[auth] RefreshToken storage unavailable (missing migration/schema). Continuing in stateless refresh mode.',
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Validates the incoming refresh token against the DB, revokes it,
   * issues a new access token + refresh token, stores the new refresh token hash,
   * and returns both tokens. Returns null if invalid or revoked.
   */
  async verifyAndRotateRefreshToken(incomingToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    payload: AuthTokenPayload;
  } | null> {
    const payload = this.verifyRefreshToken(incomingToken);
    if (!payload) {
      this.logger.warn('[auth] refresh JWT invalid or expired');
      return null;
    }

    const tokenHash = this.hashToken(incomingToken);
    let stored: {
      id: string;
      userId: string;
      revokedAt: Date | null;
      expiresAt: Date;
    } | null = null;
    try {
      stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, revokedAt: true, expiresAt: true },
      });
    } catch (error) {
      if (this.isRefreshTokenStorageUnavailableError(error)) {
        this.logger.warn(
          '[auth] RefreshToken table unavailable on refresh; rotating tokens without DB-backed revocation.',
        );
        const accessToken = this.signToken(payload);
        const refreshToken = this.signRefreshToken(payload);
        await this.storeRefreshToken(payload.sub, refreshToken);
        return { accessToken, refreshToken, payload };
      }
      throw error;
    }

    if (!stored) {
      this.logger.warn(
        '[auth] refresh token not found in DB (unknown or already rotated)',
      );
      return null;
    }
    if (stored.revokedAt) {
      this.logger.warn(
        '[auth] refresh token already revoked — possible token theft',
      );
      // Revoke ALL tokens for this user as a precaution
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }
    if (stored.expiresAt < new Date()) {
      this.logger.warn('[auth] refresh token expired in DB');
      return null;
    }

    // Revoke the old token
    try {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      if (!this.isRefreshTokenStorageUnavailableError(error)) {
        throw error;
      }
      this.logger.warn(
        '[auth] RefreshToken revoke failed due to missing schema; continuing with stateless token rotation.',
      );
    }

    // Issue new tokens
    const accessToken = this.signToken(payload);
    const refreshToken = this.signRefreshToken(payload);
    await this.storeRefreshToken(payload.sub, refreshToken);

    this.logger.log(`[auth] refresh rotated for user ${payload.sub}`);
    return { accessToken, refreshToken, payload };
  }

  async getMePayload(userId: string): Promise<{
    userId: string;
    organisationId: string;
    role: UserRole;
    capabilities: string[];
    clubId: string | null;
    displayName: string;
    clubName?: string | null;
    organisationName?: string | null;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organisationId: true,
        role: true,
        displayName: true,
        clubId: true,
        organisation: { select: { name: true } },
      },
    });
    if (!user) return null;

    const dbCapabilities = await this.prisma.userCapability.findMany({
      where: { userId: user.id },
      include: { capability: true },
    });
    const roleCapabilities = getCapabilitiesForRole(user.role as UserRole);
    const allCapabilities = [
      ...new Set([
        ...roleCapabilities,
        ...dbCapabilities.map((uc) => uc.capability.code),
      ]),
    ];

    let clubName: string | null = null;
    if (user.clubId) {
      const club = await this.prisma.club.findUnique({
        where: { id: user.clubId },
        select: { name: true },
      });
      clubName = club?.name ?? null;
    }

    return {
      userId: user.id,
      organisationId: user.organisationId,
      role: user.role as UserRole,
      capabilities: allCapabilities,
      clubId: user.clubId ?? null,
      displayName: user.displayName,
      clubName,
      organisationName: user.organisation?.name ?? null,
    };
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      if (this.isRefreshTokenStorageUnavailableError(error)) {
        this.logger.warn(
          '[auth] RefreshToken revoke skipped because storage is unavailable.',
        );
        return;
      }
      throw error;
    }
  }

  async authenticate(
    email: string,
    password: string,
  ): Promise<
    | {
        ok: true;
        userId: string;
        organisationId: string;
        role: UserRole;
        token: string;
        refreshToken: string;
      }
    | { ok: false; error: 'USER_DISABLED' | 'NO_ROLE' | 'INVALID_CREDENTIALS' }
  > {
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { capabilities: { include: { capability: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) return { ok: false, error: 'INVALID_CREDENTIALS' };
    if (!user.isActive) return { ok: false, error: 'USER_DISABLED' };

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { ok: false, error: 'INVALID_CREDENTIALS' };

    const role = user.role;
    if (!role) return { ok: false, error: 'NO_ROLE' };

    const dbCapabilities = user.capabilities.map((uc) => uc.capability.code);
    const roleCapabilities = getCapabilitiesForRole(role as UserRole);
    const allCapabilities = [
      ...new Set([...roleCapabilities, ...dbCapabilities]),
    ];

    const tokenPayload: AuthTokenPayload = {
      sub: user.id,
      organisationId: user.organisationId,
      role: role as UserRole,
      capabilities: allCapabilities,
      clubId: user.clubId ?? null,
    };

    const token = this.signToken(tokenPayload);
    const refreshToken = this.signRefreshToken(tokenPayload);

    return {
      ok: true,
      userId: user.id,
      organisationId: user.organisationId,
      role: role as UserRole,
      token,
      refreshToken,
    };
  }

  async logSignInAttempt(
    email: string,
    success: boolean,
    options?: {
      ipAddress?: string | null;
      userId?: string;
      organisationId?: string;
    },
  ): Promise<void> {
    let organisationId = options?.organisationId;
    let actorUserId = options?.userId ?? null;

    if (!organisationId) {
      const user = await this.prisma.user.findFirst({
        where: { email },
        select: { organisationId: true, id: true },
        orderBy: { createdAt: 'asc' },
      });
      organisationId = user?.organisationId;
      actorUserId = actorUserId ?? user?.id ?? null;
    }

    if (!organisationId) {
      this.logger.warn(
        `Skipping sign-in audit log: unknown organisation for ${email}`,
      );
      return;
    }

    await this.audit.write({
      organisationId,
      actorUserId,
      action: success ? 'SIGN_IN_SUCCESS' : 'SIGN_IN_FAILURE',
      entityType: 'auth',
      entityId: email,
      before: null,
      after: { success },
      reason: null,
      ipAddress: options?.ipAddress ?? null,
    });
  }
}
