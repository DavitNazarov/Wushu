import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { getCapabilitiesForRole, type UserRole } from './capabilities';
import { isUserDqActive } from '../users/users.state';
import type { AuthGuardValidationResult } from '../users/users.types';

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
  type: 'access' | 'refresh';
};

// SEC: constant-time login. When the email doesn't resolve to a usable account
// we still burn one bcrypt.compare against this throwaway hash so "unknown
// email" and "wrong password" take the same time — otherwise the early return
// is a timing oracle for valid staff emails. Generated once at module load
// (one-time ~100ms boot cost) so it is always a well-formed cost-12 hash.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('timing-equalizer-placeholder', 12);

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
    // SEC-10: a short/low-entropy secret makes HS256 tokens forgeable. Enforce a
    // minimum length so a weak secret can't slip into production unnoticed.
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    return secret;
  }

  signToken(payload: Omit<AuthTokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'access' } satisfies AuthTokenPayload,
      this.getJwtSecret(),
      {
        expiresIn: ACCESS_EXPIRES_IN_SECONDS,
      },
    );
  }

  signRefreshToken(payload: Omit<AuthTokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'refresh' } satisfies AuthTokenPayload,
      this.getJwtSecret(),
      {
        expiresIn: REFRESH_EXPIRES_IN_SECONDS,
      },
    );
  }

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret(), {
        algorithms: ['HS256'],
      }) as AuthTokenPayload;
      if (decoded.type !== 'access') return null;
      return decoded;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): AuthTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret(), {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload & AuthTokenPayload;
      if (
        typeof decoded.sub !== 'string' ||
        typeof decoded.organisationId !== 'string' ||
        typeof decoded.role !== 'string' ||
        !Array.isArray(decoded.capabilities) ||
        decoded.type !== 'refresh'
      ) {
        return null;
      }
      return {
        sub: decoded.sub,
        organisationId: decoded.organisationId,
        role: decoded.role,
        capabilities: decoded.capabilities,
        clubId: decoded.clubId ?? null,
        type: 'refresh',
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
        const isProd = process.env.NODE_ENV === 'production';
        this.logger.warn(
          '[auth] RefreshToken storage unavailable (missing migration/schema).',
        );
        if (isProd) {
          throw new Error(
            'Refresh token storage is unavailable in production. Run migrations before enabling auth.',
          );
        }
        return;
      }
      // P2002 = unique constraint violation on tokenHash — concurrent refresh request
      // already stored this token; treat as success.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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

    const validated = await this.validateAuthenticatedUser(payload.sub);
    if (!validated.ok) {
      this.logger.warn(
        `[auth] refresh rejected for user ${payload.sub}: ${validated.code}`,
      );
      return null;
    }

    const tokenHash = this.hashToken(incomingToken);
    const userId = validated.payload.sub;

    try {
      const now = new Date();
      const rotated = await this.prisma.$transaction(async (tx) => {
        // Atomic consume (compare-and-swap): flip revokedAt null→now only while
        // the row is still live. Concurrent refreshes presenting the same token
        // race on this row's write lock, so exactly one transaction sees
        // count===1 and every other sees count===0. This closes the old
        // read-then-update TOCTOU where two simultaneous refreshes could both
        // observe revokedAt=null and both rotate a single (possibly stolen) token.
        const consumed = await tx.refreshToken.updateMany({
          where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });

        // count===0 ⇒ the token is unknown, already revoked, or expired. A valid
        // refresh JWT whose stored row is no longer live means it was already
        // rotated (or replayed by a thief); the caller revokes the whole chain.
        if (consumed.count === 0) return null;

        // The single winner mints exactly one new pair and persists its hash in
        // the same transaction, so the consume rolls back if the store fails.
        const accessToken = this.signToken(validated.payload);
        const refreshToken = this.signRefreshToken(validated.payload);
        await tx.refreshToken.create({
          data: {
            userId,
            tokenHash: this.hashToken(refreshToken),
            expiresAt: new Date(Date.now() + REFRESH_EXPIRES_IN_SECONDS * 1000),
          },
        });
        return { accessToken, refreshToken };
      });

      if (!rotated) {
        // Reuse / theft detection — same precaution as before: revoke every
        // active token in this user's chain, then reject (→ INVALID_REFRESH_TOKEN).
        this.logger.warn(
          '[auth] refresh token already consumed/revoked/expired — possible token theft; revoking chain',
        );
        await this.revokeUserRefreshTokens(userId);
        return null;
      }

      this.logger.log(`[auth] refresh rotated for user ${userId}`);
      return {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        payload: validated.payload,
      };
    } catch (error) {
      if (this.isRefreshTokenStorageUnavailableError(error)) {
        const isProd = process.env.NODE_ENV === 'production';
        this.logger.warn(
          '[auth] RefreshToken table unavailable on refresh; DB-backed revocation disabled.',
        );
        if (isProd) {
          throw new Error(
            'Refresh token storage is unavailable in production. Run migrations before enabling auth.',
          );
        }
        const accessToken = this.signToken(validated.payload);
        const refreshToken = this.signRefreshToken(validated.payload);
        await this.storeRefreshToken(validated.payload.sub, refreshToken);
        return { accessToken, refreshToken, payload: validated.payload };
      }
      throw error;
    }
  }

  async validateAuthenticatedUser(
    userId: string,
  ): Promise<AuthGuardValidationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { capabilities: { include: { capability: true } } },
    });

    if (!user || user.deletedAt) return { ok: false, code: 'USER_ARCHIVED' };
    if (!user.isActive) return { ok: false, code: 'USER_DISABLED' };
    if (isUserDqActive(user)) return { ok: false, code: 'USER_SUSPENDED' };

    const dbCapabilities = user.capabilities.map((uc) => uc.capability.code);
    const roleCapabilities = getCapabilitiesForRole(user.role as UserRole);
    const allCapabilities = [
      ...new Set([...roleCapabilities, ...dbCapabilities]),
    ];

    return {
      ok: true,
      payload: {
        sub: user.id,
        organisationId: user.organisationId,
        role: user.role as UserRole,
        capabilities: allCapabilities,
        clubId: user.clubId ?? null,
        type: 'access',
      },
    };
  }

  async getMePayload(userId: string): Promise<{
    userId: string;
    organisationId: string;
    role: UserRole;
    capabilities: string[];
    clubId: string | null;
    nationality: string | null;
    displayName: string;
    clubName?: string | null;
    organisationName?: string | null;
  } | null> {
    const validated = await this.validateAuthenticatedUser(userId);
    if (!validated.ok) return null;

    // Single round-trip: /me is hot (every SSR navigation + client hydration
    // hits it, and it skips the throttler), so club/org names ride the same
    // query instead of two follow-ups.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        clubId: true,
        nationality: true,
        organisation: { select: { name: true } },
        club: { select: { name: true } },
      },
    });
    if (!user) return null;

    const clubName = user.club?.name ?? null;

    return {
      userId: validated.payload.sub,
      organisationId: validated.payload.organisationId,
      role: validated.payload.role,
      capabilities: validated.payload.capabilities,
      clubId: validated.payload.clubId ?? null,
      nationality: user.nationality ?? null,
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
        const isProd = process.env.NODE_ENV === 'production';
        this.logger.warn(
          '[auth] RefreshToken revoke skipped because storage is unavailable.',
        );
        if (isProd) {
          throw new Error(
            'Refresh token storage is unavailable in production. Run migrations before enabling auth.',
          );
        }
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
    | {
        ok: false;
        error:
          | 'USER_DISABLED'
          | 'USER_SUSPENDED'
          | 'NO_ROLE'
          | 'INVALID_CREDENTIALS';
      }
  > {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { capabilities: { include: { capability: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Unknown/disabled/suspended accounts still pay the bcrypt cost so the
    // response time doesn't reveal whether the email exists (timing oracle).
    if (!user || !user.isActive || isUserDqActive(user)) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return { ok: false, error: 'INVALID_CREDENTIALS' };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { ok: false, error: 'INVALID_CREDENTIALS' };

    // Transparent cost upgrade: legacy hashes (cost 10) re-hash to 12 on the
    // first successful login. This also converges real-account compare time
    // with the cost-12 DUMMY_BCRYPT_HASH above — with mixed costs, "unknown
    // email" vs "known email, wrong password" remain timing-distinguishable.
    const hashCost = Number(user.passwordHash.split('$')[2]);
    if (Number.isFinite(hashCost) && hashCost < 12) {
      const upgradedHash = await bcrypt.hash(password, 12);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: upgradedHash },
      });
    }

    const role = user.role;
    if (!role) return { ok: false, error: 'INVALID_CREDENTIALS' };

    const dbCapabilities = user.capabilities.map((uc) => uc.capability.code);
    const roleCapabilities = getCapabilitiesForRole(role as UserRole);
    const allCapabilities = [
      ...new Set([...roleCapabilities, ...dbCapabilities]),
    ];

    const tokenPayload = {
      sub: user.id,
      organisationId: user.organisationId,
      role: role as UserRole,
      capabilities: allCapabilities,
      clubId: user.clubId ?? null,
    } as const;

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
