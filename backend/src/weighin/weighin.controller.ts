import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WeighinService } from './weighin.service';
import { WeighinPreviewService } from './weighin-preview.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import type { WeighInDecision } from '@prisma/client';
import { parseBody } from '../common/parse-body';
import {
  weighInRecordSchema,
  weighInPreviewSchema,
  resolveOneHourSchema,
} from './weighin.schemas';

// Weigh-in workflow routes mounted at `/api/weighin`. Gated by the
// WEIGHIN_RUN capability — admins always hold it; the "weighin" role
// (a non-admin staff role) holds it too so dedicated stations can run
// the weigh-in queue without admin credentials.
@Controller('weighin')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.WEIGHIN_RUN)
export class WeighinController {
  constructor(
    private readonly weighin: WeighinService,
    private readonly previewService: WeighinPreviewService,
  ) {}

  // GET /api/weighin?eventId=...&q=... — search for athletes by name or
  // document id in a specific event. Delegates to WeighinService.search,
  // which scopes to APPROVED registrations only and returns weigh-in status
  // alongside the row so the queue UI can color-code accordingly.
  @Get()
  async search(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
    @Query('q') q?: string,
  ) {
    const auth = req.auth!;
    if (!eventId)
      throw new HttpException('eventId_REQUIRED', HttpStatus.BAD_REQUEST);
    return this.weighin.search({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      eventId,
      q,
    });
  }

  // POST /api/weighin — record one weigh-in attempt.
  // Body: registrationId, weightKg, optional explicit decision (admins
  // overriding the auto-decision), override+reason, and nextEventWeightCategoryId
  // for MOVE_UP decisions.
  // Service maps known errors:
  //   REGISTRATION_NOT_FOUND | EVENT_NOT_FOUND                           → 404
  //   EVENT_NOT_IN_WEIGHIN | OVERRIDE_REASON_REQUIRED | INVALID_WEIGHT,
  //   REGISTRATION_CATEGORY_NOT_SET | OVERRIDE_DECISION_REQUIRED,
  //   MANUAL_DECISION_REQUIRED | MANUAL_DECISION_REASON_REQUIRED,
  //   DECISION_NOT_ALLOWED_FOR_AUTO_POLICY | INVALID_MOVE_UP_CATEGORY,
  //   NO_HIGHER_CATEGORY_AVAILABLE                                       → 400
  @Post()
  async record(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = parseBody(weighInRecordSchema, body);

    try {
      return await this.weighin.record({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        registrationId: parsed.registrationId,
        weightKg: parsed.weightKg,
        decision: parsed.decision as WeighInDecision | undefined,
        override: parsed.override ?? false,
        reason: parsed.reason ?? null,
        nextEventWeightCategoryId: parsed.nextEventWeightCategoryId ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'REGISTRATION_NOT_FOUND' || msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'EVENT_NOT_IN_WEIGHIN' ||
        msg === 'REGISTRATION_NOT_APPROVED' ||
        msg === 'OVERRIDE_REASON_REQUIRED' ||
        msg === 'REGISTRATION_CATEGORY_NOT_SET' ||
        msg === 'OVERRIDE_DECISION_REQUIRED' ||
        msg === 'MANUAL_DECISION_REQUIRED' ||
        msg === 'MANUAL_DECISION_REASON_REQUIRED' ||
        msg === 'DECISION_NOT_ALLOWED_FOR_AUTO_POLICY' ||
        msg === 'INVALID_MOVE_UP_CATEGORY' ||
        msg === 'NO_HIGHER_CATEGORY_AVAILABLE' ||
        msg === 'INVALID_WEIGHT'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }

  // POST /api/weighin/preview — dry-run for the weigh-in form.
  // Same inputs as /record but never writes — returns what the decision
  // WOULD be, so the UI can show the operator "weight 64.2kg → category B,
  // PASS" before they commit.
  @Post('preview')
  async preview(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = parseBody(weighInPreviewSchema, body);

    try {
      return await this.previewService.preview({
        organisationId: auth.organisationId,
        registrationId: parsed.registrationId,
        weightKg: parsed.weightKg,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'REGISTRATION_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (msg === 'REGISTRATION_CATEGORY_NOT_SET' || msg === 'INVALID_WEIGHT') {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }

  // POST /api/weighin/:registrationId/reconcile-category — admin fix-up tool
  // for registrations whose categoryCode string no longer matches any
  // eventWeightCategory row (typically after a category template edit).
  // Errors:
  //   CATEGORY_CODE_MISSING / NO_MATCHING_EVENT_CATEGORY /
  //   AMBIGUOUS_EVENT_CATEGORY_MATCH                          → 400
  @Post(':registrationId/reconcile-category')
  async reconcileCategory(
    @Param('registrationId') registrationId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { reason?: string },
  ) {
    const auth = req.auth!;
    try {
      return await this.weighin.reconcileCategoryMapping({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        registrationId,
        reason: body.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'REGISTRATION_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'CATEGORY_CODE_MISSING' ||
        msg === 'NO_MATCHING_EVENT_CATEGORY' ||
        msg === 'AMBIGUOUS_EVENT_CATEGORY_MATCH'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }

  // POST /api/weighin/:id/resolve — settle a pending "1-hour reweigh" attempt.
  // After a fail, IWUF rules give the athlete one hour to reweigh OR be
  // moved up a class. This endpoint records that final disposition.
  //   action='MOVE_UP': promote to nextEventWeightCategoryId (must be valid +
  //                    not the same class). NO_HIGHER_CATEGORY_AVAILABLE if
  //                    there's no class above them.
  //   action='DQ':     mark as disqualified.
  // ALREADY_RESOLVED → 409 to prevent double-resolving the same attempt.
  @Post(':id/resolve')
  async resolveOneHour(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = parseBody(resolveOneHourSchema, body);
    try {
      return await this.weighin.resolveOneHour({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        attemptId: id,
        action: parsed.action,
        nextEventWeightCategoryId: parsed.nextEventWeightCategoryId ?? null,
        newCategoryCode: parsed.newCategoryCode,
        reason: parsed.reason ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'ATTEMPT_NOT_FOUND')
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      if (msg === 'ALREADY_RESOLVED')
        throw new HttpException(msg, HttpStatus.CONFLICT);
      if (
        msg === 'INVALID_MOVE_UP_CATEGORY' ||
        msg === 'NO_HIGHER_CATEGORY_AVAILABLE' ||
        msg === 'MOVE_UP_CATEGORY_REQUIRED'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }
}
