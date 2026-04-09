import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { UsersService } from './users.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import {
  createUserSchema,
  suspendUserSchema,
  updateUserSchema,
} from './users.schemas';

@Controller('admin/users')
@UseGuards(AuthGuard, CapabilityGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async list(@Req() req: AuthenticatedRequest) {
    return this.users.list(req.auth!.organisationId);
  }

  @Post()
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = this.parseBody(createUserSchema, body);

    try {
      return await this.users.create({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        email: parsed.email,
        password: parsed.password,
        displayName: parsed.displayName,
        role: parsed.role,
        clubId: parsed.clubId ?? null,
      });
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  @Get(':id')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    try {
      return await this.users.getById(req.auth!.organisationId, id);
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  @Patch(':id')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = this.parseBody(updateUserSchema, body);

    try {
      return await this.users.update({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        userId: id,
        email: parsed.email,
        displayName: parsed.displayName,
        role: parsed.role,
        clubId: parsed.clubId,
        isActive: parsed.isActive,
      });
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  @Post(':id/dq')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async suspend(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = this.parseBody(suspendUserSchema, body);

    try {
      return await this.users.suspend({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        userId: id,
        reason: parsed.reason,
        startAt: new Date(parsed.startAt),
        endAt: new Date(parsed.endAt),
        note: parsed.note ?? null,
      });
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  @Post(':id/remove-dq')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async removeSuspension(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      return await this.users.removeSuspension({
        organisationId: req.auth!.organisationId,
        actorUserId: req.auth!.sub,
        userId: id,
      });
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  @Delete(':id')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async archive(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    try {
      return await this.users.archive({
        organisationId: req.auth!.organisationId,
        actorUserId: req.auth!.sub,
        userId: id,
      });
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  @Get(':id/activity')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async getActivity(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      return await this.users.getActivity(req.auth!.organisationId, id);
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  @Get(':id/capabilities')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async getCapabilities(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    try {
      return await this.users.getCapabilities(req.auth!.organisationId, id);
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  private parseBody<T extends z.ZodTypeAny>(
    schema: T,
    body: unknown,
  ): z.infer<T> {
    try {
      return schema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }
      throw error;
    }
  }

  private rethrowKnownError(error: unknown): never {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    if (message === 'USER_NOT_FOUND') {
      throw new HttpException('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (
      message === 'COACH_CLUB_REQUIRED' ||
      message === 'ADMIN_CLUB_FORBIDDEN' ||
      message === 'INVALID_CLUB' ||
      message === 'INVALID_DQ_RANGE' ||
      message === 'USER_ALREADY_SUSPENDED' ||
      message === 'USER_NOT_SUSPENDED' ||
      message === 'USER_ARCHIVED'
    ) {
      throw new BadRequestException({
        code: message,
        message: this.errorMessage(message),
      });
    }

    if (
      message === 'SELF_DELETE_FORBIDDEN' ||
      message === 'SELF_DQ_FORBIDDEN'
    ) {
      throw new HttpException(
        { code: message, message: this.errorMessage(message) },
        HttpStatus.FORBIDDEN,
      );
    }

    if (message === 'EMAIL_ALREADY_IN_USE') {
      throw new HttpException('EMAIL_ALREADY_IN_USE', HttpStatus.CONFLICT);
    }

    throw new HttpException(
      'Internal Server Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private errorMessage(code: string): string {
    switch (code) {
      case 'COACH_CLUB_REQUIRED':
        return 'Coach must belong to a club';
      case 'ADMIN_CLUB_FORBIDDEN':
        return 'Admin cannot belong to a club';
      case 'INVALID_CLUB':
        return 'Club not found';
      case 'INVALID_DQ_RANGE':
        return 'Suspension end date must be after start date and in the future';
      case 'USER_ALREADY_SUSPENDED':
        return 'User is already suspended';
      case 'USER_NOT_SUSPENDED':
        return 'User is not currently suspended';
      case 'USER_ARCHIVED':
        return 'Archived users cannot be changed';
      case 'SELF_DELETE_FORBIDDEN':
        return 'You cannot archive your own account';
      case 'SELF_DQ_FORBIDDEN':
        return 'You cannot suspend your own account';
      default:
        return code;
    }
  }
}
