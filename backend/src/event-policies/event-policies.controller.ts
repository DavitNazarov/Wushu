import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventPoliciesService } from './event-policies.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { EventPolicyInputSchema } from './event-policy.schemas';

@Controller('event-policies')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.EVENTS_MANAGE)
export class EventPoliciesController {
  constructor(private readonly policies: EventPoliciesService) {}

  @Get('options')
  getOptions() {
    return this.policies.getOptions();
  }

  @Get('events/:eventId')
  async getEventPolicies(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    const auth = req.auth!;
    try {
      return await this.policies.getForEvent(eventId, auth.organisationId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      throw e;
    }
  }

  @Patch('events/:eventId')
  async updateEventPolicies(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = EventPolicyInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid event policy payload',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.policies.updateForEvent({
        eventId,
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        policyInput: parsed.data,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'EVENT_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (
        msg === 'INVALID_MIN_REST_MINUTES' ||
        msg === 'INVALID_REWEIGH_WINDOW_MINUTES' ||
        msg === 'MIN_REST_POLICY_REQUIRES_15_MINUTES' ||
        msg === 'IWUF_STRICT_POLICY_REQUIRES_60_MINUTE_WINDOW' ||
        msg === 'OVERRIDE_REASON_REQUIRED'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }
}
