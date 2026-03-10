import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import {
  buildEventPolicyOptions,
  readEventPolicies,
  resolveEventPolicies,
} from './event-policy.resolver';
import type { EventPolicyInput } from './event-policy.types';

@Injectable()
export class EventPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getOptions() {
    return buildEventPolicyOptions();
  }

  async getForEvent(eventId: string, organisationId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
      select: {
        id: true,
        lifecycle: true,
        weighInPolicyCode: true,
        bronzePolicyCode: true,
        restPolicyCode: true,
        minRestMinutes: true,
        publishTimingPolicyCode: true,
        reweighWindowMinutes: true,
      },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    return {
      eventId: event.id,
      lifecycle: event.lifecycle,
      policies: readEventPolicies(event),
    };
  }

  async updateForEvent(input: {
    eventId: string;
    organisationId: string;
    actorUserId: string;
    policyInput: EventPolicyInput;
    reason?: string | null;
  }) {
    const existing = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
      select: {
        id: true,
        lifecycle: true,
        weighInPolicyCode: true,
        bronzePolicyCode: true,
        restPolicyCode: true,
        minRestMinutes: true,
        publishTimingPolicyCode: true,
        reweighWindowMinutes: true,
      },
    });
    if (!existing) throw new Error('EVENT_NOT_FOUND');

    if (existing.lifecycle === 'COMPLETED' && !input.reason?.trim()) {
      throw new Error('OVERRIDE_REASON_REQUIRED');
    }

    const merged = resolveEventPolicies({
      ...readEventPolicies(existing),
      ...input.policyInput,
    });

    const updated = await this.prisma.event.update({
      where: { id: input.eventId },
      data: {
        weighInPolicyCode: merged.weighInPolicyCode,
        bronzePolicyCode: merged.bronzePolicyCode,
        restPolicyCode: merged.restPolicyCode,
        minRestMinutes: merged.minRestMinutes,
        publishTimingPolicyCode: merged.publishTimingPolicyCode,
        reweighWindowMinutes: merged.reweighWindowMinutes,
      },
      select: {
        id: true,
        lifecycle: true,
        weighInPolicyCode: true,
        bronzePolicyCode: true,
        restPolicyCode: true,
        minRestMinutes: true,
        publishTimingPolicyCode: true,
        reweighWindowMinutes: true,
      },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      eventId: input.eventId,
      actorUserId: input.actorUserId,
      action: 'EVENT_POLICIES_UPDATED',
      entityType: 'event',
      entityId: input.eventId,
      before: readEventPolicies(existing) as unknown as Prisma.JsonValue,
      after: readEventPolicies(updated) as unknown as Prisma.JsonValue,
      reason: input.reason ?? null,
      override: existing.lifecycle === 'COMPLETED',
    });

    return {
      eventId: updated.id,
      lifecycle: updated.lifecycle,
      policies: readEventPolicies(updated),
    };
  }
}
