import {
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
import Express from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
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

// Cookie defaults. maxAge is in milliseconds — Express divides by 1000 for Max-Age header.
// IMPORTANT: using seconds here would give Max-Age≈0 which instantly deletes the cookie.
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

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
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Express.Response,
    @Req() req: Express.Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null;
    const result = await this.auth.authenticate(body.email, body.password);

    if (!result.ok) {
      await this.auth.logSignInAttempt(body.email, false, { ipAddress });
      res.status(HttpStatus.UNAUTHORIZED);
      return { error: result.error };
    }

    res.cookie(JWT_COOKIE_NAME, result.token, {
      ...COOKIE_BASE,
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    });
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...COOKIE_BASE,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    // Store refresh token hash in DB for rotation + revocation
    await this.auth.storeRefreshToken(result.userId, result.refreshToken);

    await this.auth.logSignInAttempt(body.email, true, {
      ipAddress,
      userId: result.userId,
      organisationId: result.organisationId,
    });

    this.logger.log(`[auth] login ok for ${body.email}`);
    return { ok: true, role: result.role };
  }

  @Post('refresh')
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
      res.clearCookie(JWT_COOKIE_NAME, { path: '/' });
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      res.status(HttpStatus.UNAUTHORIZED);
      return { error: 'INVALID_REFRESH_TOKEN' };
    }

    res.cookie(JWT_COOKIE_NAME, rotated.accessToken, {
      ...COOKIE_BASE,
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    });
    res.cookie(REFRESH_COOKIE_NAME, rotated.refreshToken, {
      ...COOKIE_BASE,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
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

    res.clearCookie(JWT_COOKIE_NAME, { path: '/' });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
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
      displayName: me.displayName,
      clubName: me.clubName,
      organisationName: me.organisationName,
    };
  }

  @Post('signup')
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async signup(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      email: string;
      password: string;
      displayName: string;
      role: 'coach' | 'athlete' | 'judge' | 'timekeeper';
    },
  ) {
    const auth = req.auth;
    if (!auth)
      throw new HttpException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);

    try {
      const result = await this.authUser.registerUser({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        role: body.role,
      });
      return { ok: true, id: result.id };
    } catch (e: any) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'EMAIL_ALREADY_IN_USE')
        throw new HttpException('EMAIL_ALREADY_IN_USE', HttpStatus.CONFLICT);
      if (message === 'CANNOT_CREATE_ADMIN_VIA_API')
        throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bootstrap-admin')
  async bootstrapAdmin(
    @Body() body: { email: string; password: string; displayName: string },
  ) {
    try {
      const result = await this.authUser.bootstrapInitialAdmin({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
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
