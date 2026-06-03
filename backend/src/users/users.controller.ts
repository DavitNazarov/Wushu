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

// Admin user management routes mounted at `/api/admin/users`.
// Every endpoint requires the EVENTS_MANAGE capability — we reuse this
// existing top-level admin permission rather than introducing a separate
// USERS_MANAGE, since only admins have it anyway.
@Controller('admin/users')
@UseGuards(AuthGuard, CapabilityGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // GET /api/admin/users — list every user in the caller's organisation
  // (used by the admin users index page).
  @Get()
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async list(@Req() req: AuthenticatedRequest) {
    return this.users.list(req.auth!.organisationId);
  }

  // POST /api/admin/users — create a new admin/coach/judge/timekeeper.
  // Body is validated by createUserSchema; nationality + clubId are coach-only
  // hints used to drive the coach athlete form (see CLAUDE.md "Coach Nationality").
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
        nationality: parsed.nationality ?? null,
      });
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  // GET /api/admin/users/:id — single-user detail for the admin edit drawer.
  @Get(':id')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    try {
      return await this.users.getById(req.auth!.organisationId, id);
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  // PATCH /api/admin/users/:id — partial update (email, displayName, role,
  // clubId, nationality, isActive). Service enforces role/club consistency
  // (COACH_CLUB_REQUIRED, ADMIN_CLUB_FORBIDDEN) and these surface as 400s
  // via rethrowKnownError.
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
        nationality: parsed.nationality,
        isActive: parsed.isActive,
      });
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  // POST /api/admin/users/:id/dq — suspend ("DQ") a user for a fixed window.
  // Used for coach disqualifications. Returns SELF_DQ_FORBIDDEN if the actor
  // tries to suspend themselves, and INVALID_DQ_RANGE if end ≤ start.
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

  // POST /api/admin/users/:id/remove-dq — clear an active suspension early.
  // Returns USER_NOT_SUSPENDED if there's no active DQ to clear.
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

  // DELETE /api/admin/users/:id — soft-archive (NOT a hard delete). Sets
  // isArchived=true to preserve audit history and FK integrity. Blocks
  // self-archive (SELF_DELETE_FORBIDDEN) so admins can't lock themselves out.
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

  // GET /api/admin/users/:id/activity — audit-log slice for this user
  // (logins, actions taken, suspensions issued). Powers the "Activity" tab
  // in the admin user drawer.
  @Get(':id/activity')
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async getActivity(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    try {
      return await this.users.getActivity(req.auth!.organisationId, id);
    } catch (error) {
      this.rethrowKnownError(error);
    }
  }

  // GET /api/admin/users/:id/capabilities — the computed permission set
  // (capabilities derived from role + flags). Used by the admin to inspect
  // what a user can actually do at runtime.
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

  // Shared Zod-parse helper. Converts Zod validation errors into a
  // 400 BadRequest with a structured { code, message, issues } body the
  // frontend can render field-level error messages from. Any non-Zod error
  // is rethrown unchanged.
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

  // Maps service-layer string errors (thrown as `throw new Error('CODE')`) to
  // the correct HTTP status:
  //   USER_NOT_FOUND                                  → 404
  //   COACH_CLUB_REQUIRED | ADMIN_CLUB_FORBIDDEN
  //   INVALID_CLUB | INVALID_DQ_RANGE
  //   USER_ALREADY_SUSPENDED | USER_NOT_SUSPENDED
  //   USER_ARCHIVED                                   → 400
  //   SELF_DELETE_FORBIDDEN | SELF_DQ_FORBIDDEN       → 403
  //   EMAIL_ALREADY_IN_USE                            → 409
  //   anything else                                   → 500
  // Returns `never` so callers can use it in a tail-position throw.
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

  // Human-readable copy for each error code. Returned as the `message`
  // field next to the machine-readable `code`, so the frontend can show the
  // text directly (or translate via `code` if it has its own i18n).
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
