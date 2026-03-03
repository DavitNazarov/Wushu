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
} from '@nestjs/common';
import Express from 'express';
import { AuthService, JWT_COOKIE_NAME } from './auth.service';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthGuard } from './auth.guard';
import { CapabilityGuard } from './capability.guard';
import { RequireCapability } from './capability.decorator';
import { CAPABILITIES } from './capabilities';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Req() req: Express.Request) {
    const token = req.cookies?.[JWT_COOKIE_NAME] ?? req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { userId: null, organisationId: null, role: null, capabilities: [] };
    const payload = this.auth.verifyToken(token);
    if (!payload) return { userId: null, organisationId: null, role: null, capabilities: [] };
    return {
      userId: payload.sub,
      organisationId: payload.organisationId,
      role: payload.role,
      capabilities: payload.capabilities,
    };
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Express.Response,
    @Req() req: Express.Request,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null;

    const result = await this.auth.authenticate(body.email, body.password);

    if (!result.ok) {
      await this.auth.logSignInAttempt(body.email, false, { ipAddress });
      res.status(HttpStatus.UNAUTHORIZED);
      return { error: result.error };
    }

    res.cookie(JWT_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    await this.auth.logSignInAttempt(body.email, true, {
      ipAddress,
      userId: result.userId,
      organisationId: result.organisationId,
    });

    return { ok: true, role: result.role };
  }

  @Post('signup')
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async signup(
    @Req() req: AuthenticatedRequest,
    @Body() body: { email: string; password: string; displayName: string; role: 'coach' | 'athlete' },
  ) {
    const auth = req.auth;
    if (!auth) {
      throw new HttpException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
    }

    try {
      const result = await this.auth.registerUser({
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
      if (message === 'EMAIL_ALREADY_IN_USE') {
        throw new HttpException('EMAIL_ALREADY_IN_USE', HttpStatus.CONFLICT);
      }
      if (message === 'CANNOT_CREATE_ADMIN_VIA_API') {
        throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('bootstrap-admin')
  async bootstrapAdmin(
    @Body() body: { email: string; password: string; displayName: string },
  ) {
    try {
      const result = await this.auth.bootstrapInitialAdmin({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });

      return { ok: true, id: result.id, organisationId: result.organisationId };
    } catch (e: any) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'BOOTSTRAP_ALREADY_COMPLETED') {
        throw new HttpException('BOOTSTRAP_ALREADY_COMPLETED', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
