import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpStatus,
  UseGuards,
  HttpException,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { loginSchema, signupSchema, bootstrapAdminSchema } from './auth.schemas';
import Express from 'express';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import {
  AuthService,
  JWT_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_MAX_AGE_MS,
} from './auth.service';
import { AuthUserService } from './auth-user.service';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthGuard } from './auth.guard';
import { CapabilityGuard } from './capability.guard';
import { RequireCapability } from './capability.decorator';
import { CAPABILITIES } from './capabilities';
import {
  getAuthCookieOptions,
  getAuthCookieClearOptions,
} from './auth-cookie.config';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly authUser: AuthUserService,
  ) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Express.Response,
    @Req() req: Express.Request,
  ) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      res.status(HttpStatus.BAD_REQUEST);
      return {
        error: 'VALIDATION_ERROR',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null;
    const result = await this.auth.authenticate(
      parsed.data.email,
      parsed.data.password,
    );

    if (!result.ok) {
      await this.auth.logSignInAttempt(parsed.data.email, false, { ipAddress });
      res.status(HttpStatus.UNAUTHORIZED);
      return { error: result.error };
    }

    res.cookie(JWT_COOKIE_NAME, result.token, {
      ...getAuthCookieOptions(ACCESS_COOKIE_MAX_AGE_MS),
    });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...getAuthCookieOptions(REFRESH_COOKIE_MAX_AGE_MS),
    });

    // Store refresh token hash in DB for rotation + revocation
    await this.auth.storeRefreshToken(result.userId, result.refreshToken);

    await this.auth.logSignInAttempt(parsed.data.email, true, {
      ipAddress,
      userId: result.userId,
      organisationId: result.organisationId,
    });

    this.logger.log('[auth] login ok');
    return { ok: true, role: result.role };
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const incomingRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;

    if (!incomingRefreshToken) {
      this.logger.warn('[auth] POST /refresh — no refresh cookie');
      res.status(HttpStatus.UNAUTHORIZED);
      return { error: 'NO_REFRESH_TOKEN' };
    }

    const rotated =
      await this.auth.verifyAndRotateRefreshToken(incomingRefreshToken);

    if (!rotated) {
      this.logger.warn('[auth] POST /refresh — token invalid or revoked');
      // Clear stale cookies so the client is in a clean state
      res.clearCookie(JWT_COOKIE_NAME, getAuthCookieClearOptions());
      res.clearCookie(REFRESH_COOKIE_NAME, getAuthCookieClearOptions());
      res.status(HttpStatus.UNAUTHORIZED);
      return { error: 'INVALID_REFRESH_TOKEN' };
    }

    res.cookie(JWT_COOKIE_NAME, rotated.accessToken, {
      ...getAuthCookieOptions(ACCESS_COOKIE_MAX_AGE_MS),
    });
    res.cookie(REFRESH_COOKIE_NAME, rotated.refreshToken, {
      ...getAuthCookieOptions(REFRESH_COOKIE_MAX_AGE_MS),
    });

    this.logger.log(
      `[auth] POST /refresh — rotated ok for user ${rotated.payload.sub}`,
    );
    return { ok: true };
  }

  @Post('logout')
  async logout(
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const incomingRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;

    if (incomingRefreshToken) {
      // Best-effort: revoke all user tokens (we parse user from the token)
      const payload = this.auth.verifyRefreshToken(incomingRefreshToken);
      if (payload?.sub) {
        await this.auth.revokeUserRefreshTokens(payload.sub);
        this.logger.log(
          `[auth] logout — revoked tokens for user ${payload.sub}`,
        );
      }
    }

    res.clearCookie(JWT_COOKIE_NAME, getAuthCookieClearOptions());
    res.clearCookie(REFRESH_COOKIE_NAME, getAuthCookieClearOptions());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async me(
    @Req() req: Express.Request,
    @Res({ passthrough: true }) res: Express.Response,
  ) {
    const token =
      (req.cookies?.[JWT_COOKIE_NAME] as string | undefined) ??
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        userId: null,
        organisationId: null,
        role: null,
        capabilities: [],
        clubId: null,
      };
    }

    const payload = this.auth.verifyToken(token);
    if (!payload) {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        userId: null,
        organisationId: null,
        role: null,
        capabilities: [],
        clubId: null,
      };
    }

    const me = await this.auth.getMePayload(payload.sub);
    if (!me) {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        userId: null,
        organisationId: null,
        role: null,
        capabilities: [],
        clubId: null,
      };
    }

    return {
      userId: me.userId,
      organisationId: me.organisationId,
      role: me.role,
      capabilities: me.capabilities,
      clubId: me.clubId,
      nationality: me.nationality,
      displayName: me.displayName,
      clubName: me.clubName,
      organisationName: me.organisationName,
    };
  }

  @Post('signup')
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async signup(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth;
    if (!auth)
      throw new HttpException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid signup payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    try {
      const result = await this.authUser.registerUser({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        role: parsed.data.role,
        clubId: parsed.data.clubId ?? null,
        nationality: parsed.data.nationality ?? null,
      });
      return { ok: true, id: result.id };
    } catch (e: any) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'EMAIL_ALREADY_IN_USE')
        throw new HttpException('EMAIL_ALREADY_IN_USE', HttpStatus.CONFLICT);
      if (message === 'COACH_CLUB_REQUIRED') {
        throw new BadRequestException({
          code: 'COACH_CLUB_REQUIRED',
          message: 'Coach must belong to a club',
        });
      }
      if (message === 'ADMIN_CLUB_FORBIDDEN') {
        throw new BadRequestException({
          code: 'ADMIN_CLUB_FORBIDDEN',
          message: 'Admin cannot belong to a club',
        });
      }
      if (message === 'USER_ROLE_CLUB_INVALID') {
        throw new BadRequestException({
          code: 'USER_ROLE_CLUB_INVALID',
          message: 'Only coaches can belong to a club',
        });
      }
      if (message === 'INVALID_CLUB') {
        throw new BadRequestException({
          code: 'INVALID_CLUB',
          message: 'Club not found',
        });
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bootstrap-admin')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async bootstrapAdmin(
    @Body() body: unknown,
  ) {
    const parsed = bootstrapAdminSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid bootstrap payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    // If BOOTSTRAP_SECRET is configured in the environment, the caller must
    // present the matching value. This prevents an attacker who can reach the
    // API before the operator from hijacking the initial admin account.
    const requiredSecret = process.env.BOOTSTRAP_SECRET?.trim();
    if (requiredSecret) {
      const provided = parsed.data.bootstrapSecret?.trim();
      const expectedBuffer = Buffer.from(requiredSecret, 'utf8');
      const providedBuffer = Buffer.from(provided ?? '', 'utf8');
      if (
        expectedBuffer.length !== providedBuffer.length ||
        !timingSafeEqual(expectedBuffer, providedBuffer)
      ) {
        throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
      }
    }

    // Refuse the endpoint entirely in production when no secret is configured —
    // the bootstrap should always be a deliberate, secret-guarded action.
    if (process.env.NODE_ENV === 'production' && !requiredSecret) {
      this.logger.error(
        '[auth] bootstrap-admin called in production without BOOTSTRAP_SECRET — refusing',
      );
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    try {
      const result = await this.authUser.bootstrapInitialAdmin({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
      });
      return { ok: true, id: result.id, organisationId: result.organisationId };
    } catch (e: any) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'BOOTSTRAP_ALREADY_COMPLETED') {
        throw new HttpException(
          'BOOTSTRAP_ALREADY_COMPLETED',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
