import type { Event, Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { RulesetsService } from '../rulesets/rulesets.service';
import { EventStageAutomationService } from './event-stage-automation.service';
import {
  readEventPolicies,
  resolveEventPolicies,
} from '../event-policies/event-policy.resolver';
import {
  isLegacyDatesInput,
  listDaysInclusive,
  type CanonicalDatesDto,
  type CreateEventDto,
  type LegacyDatesDto,
  type UpdateEventDto,
} from './event.types';
import { canDiscoverEventPublicly } from './public-event-access';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rulesets: RulesetsService,
    private readonly automation: EventStageAutomationService,
  ) {}

  async getById(
    eventId: string,
    organisationId: string,
  ): Promise<Event | null> {
    try {
      await this.automation.maybeAutoAdvanceById(eventId);
    } catch (error) {
      this.logger.error(
        `Auto-advance check failed for event ${eventId}: ${String(error)}`,
      );
    }
    return this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
    });
  }

  async list(organisationId: string): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { organisationId },
      orderBy: { competitionStartDate: 'desc' },
    });
  }

  async listPublished(): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { published: true },
      orderBy: { competitionStartDate: 'desc' },
    });
  }

  async listPublicAndRegistrable(): Promise<Event[]> {
    const events = await this.prisma.event.findMany({
      orderBy: { competitionStartDate: 'desc' },
    });

    return events.filter((event) => canDiscoverEventPublicly(event));
  }

  async getPublishedBySlug(slug: string): Promise<Event | null> {
    return this.prisma.event.findFirst({
      where: { slug, published: true },
    });
  }

  async getPublicOrRegistrableBySlug(slug: string): Promise<Event | null> {
    const found = await this.prisma.event.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!found) return null;

    try {
      await this.automation.maybeAutoAdvanceById(found.id);
    } catch (error) {
      this.logger.error(
        `Auto-advance check failed for event ${found.id}: ${String(error)}`,
      );
    }

    const event = await this.prisma.event.findFirst({
      where: { id: found.id },
    });

    if (!event) {
      return null;
    }

    return canDiscoverEventPublicly(event) ? event : null;
  }

  async create(
    organisationId: string,
    actorUserId: string,
    dto: CreateEventDto,
  ): Promise<Event> {
    const { name, slug, location, timezone, autoAdvanceStage, policies } = dto;
    const normalized = this.normalizeDates(dto, timezone);
    const resolvedPolicies = resolveEventPolicies(policies);
    const selectedRuleset = dto.rulesetId
      ? await this.rulesets.getForEventSelection(organisationId, dto.rulesetId)
      : await this.rulesets.getActive(organisationId);
    if (!selectedRuleset) {
      throw new Error(
        dto.rulesetId ? 'RULESET_NOT_FOUND' : 'RULESET_SELECTION_REQUIRED',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          organisation: { connect: { id: organisationId } },
          name,
          slug,
          location,
          timezone,
          autoAdvanceStage: autoAdvanceStage ?? false,
          registrationStartDate: normalized.registrationStartDate,
          registrationEndDate: normalized.registrationEndDate,
          weighInStartDate: normalized.weighInStartDate,
          weighInEndDate: normalized.weighInEndDate,
          competitionStartDate: normalized.competitionStartDate,
          competitionEndDate: normalized.competitionEndDate,
          registrationOpensAt: normalized.registrationOpensAt,
          registrationClosesAt: normalized.registrationClosesAt,
          dates: normalized.datesJson,
          weighInPolicyCode: resolvedPolicies.weighInPolicyCode,
          bronzePolicyCode: resolvedPolicies.bronzePolicyCode,
          restPolicyCode: resolvedPolicies.restPolicyCode,
          minRestMinutes: resolvedPolicies.minRestMinutes,
          publishTimingPolicyCode: resolvedPolicies.publishTimingPolicyCode,
          reweighWindowMinutes: resolvedPolicies.reweighWindowMinutes,
        },
      });

      await tx.eventRulesetSnapshot.create({
        data: {
          eventId: event.id,
          rulesetId: selectedRuleset.id,
          version: selectedRuleset.version,
          snapshot: selectedRuleset.definition as Prisma.InputJsonValue,
        },
      });

      await this.audit.write(
        {
          organisationId,
          eventId: event.id,
          actorUserId,
          action: 'EVENT_CREATED',
          entityType: 'event',
          entityId: event.id,
          before: null,
          after: event as unknown as Prisma.JsonValue,
          reason: null,
          ipAddress: null,
        },
        tx,
      );

      return event;
    });
  }

  async update(
    eventId: string,
    organisationId: string,
    actorUserId: string,
    dto: UpdateEventDto,
  ): Promise<Event> {
    const existing = await this.getById(eventId, organisationId);
    if (!existing) throw new Error('EVENT_NOT_FOUND');

    const { name, slug, location, timezone, autoAdvanceStage, policies } = dto;
    const normalized = this.normalizeDates(dto, timezone);
    const resolvedPolicies = resolveEventPolicies({
      ...readEventPolicies(existing),
      ...(policies ?? {}),
    });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          name,
          slug,
          location,
          timezone,
          autoAdvanceStage: autoAdvanceStage ?? existing.autoAdvanceStage,
          registrationStartDate: normalized.registrationStartDate,
          registrationEndDate: normalized.registrationEndDate,
          weighInStartDate: normalized.weighInStartDate,
          weighInEndDate: normalized.weighInEndDate,
          competitionStartDate: normalized.competitionStartDate,
          competitionEndDate: normalized.competitionEndDate,
          registrationOpensAt: normalized.registrationOpensAt,
          registrationClosesAt: normalized.registrationClosesAt,
          dates: normalized.datesJson,
          weighInPolicyCode: resolvedPolicies.weighInPolicyCode,
          bronzePolicyCode: resolvedPolicies.bronzePolicyCode,
          restPolicyCode: resolvedPolicies.restPolicyCode,
          minRestMinutes: resolvedPolicies.minRestMinutes,
          publishTimingPolicyCode: resolvedPolicies.publishTimingPolicyCode,
          reweighWindowMinutes: resolvedPolicies.reweighWindowMinutes,
        },
      });

      await this.audit.write(
        {
          organisationId,
          eventId,
          actorUserId,
          action: 'EVENT_UPDATED',
          entityType: 'event',
          entityId: eventId,
          before: existing as unknown as Prisma.JsonValue,
          after: updated as unknown as Prisma.JsonValue,
          reason: null,
          ipAddress: null,
        },
        tx,
      );

      return updated;
    });
  }

  private normalizeDates(dto: CreateEventDto, timezone: string) {
    if (isLegacyDatesInput(dto.dates)) {
      return this.normalizeLegacyDates(
        dto.dates,
        timezone,
        dto.registrationWindow,
      );
    }

    return this.normalizeCanonicalDates(
      dto.dates,
      timezone,
      dto.registrationWindow,
    );
  }

  private normalizeLegacyDates(
    dates: LegacyDatesDto,
    timezone: string,
    registrationWindow?: { opensAt: string; closesAt?: string },
  ) {
    const sortedRegistration = [...dates.registrationDays].sort();
    const registrationStart = sortedRegistration[0];
    const registrationEnd = sortedRegistration[sortedRegistration.length - 1];

    const competitionStart = dates.range.startDate;
    const competitionEnd = dates.range.endDate;

    const toStartOfDayUtc = (date: string) =>
      fromZonedTime(`${date}T00:00:00`, timezone);
    const toEndOfDayUtc = (date: string) =>
      fromZonedTime(`${date}T23:59:59.999`, timezone);

    const defaultOpensDate = (() => {
      const d = new Date(toStartOfDayUtc(competitionStart));
      d.setUTCDate(d.getUTCDate() - 30);
      return d;
    })();

    const registrationOpensAt = registrationWindow?.opensAt
      ? toStartOfDayUtc(registrationWindow.opensAt)
      : defaultOpensDate;

    const registrationClosesAt = registrationWindow?.closesAt
      ? toStartOfDayUtc(registrationWindow.closesAt)
      : toStartOfDayUtc(registrationStart);

    return {
      registrationStartDate: toStartOfDayUtc(registrationStart),
      registrationEndDate: toEndOfDayUtc(registrationEnd),
      weighInStartDate: toStartOfDayUtc(registrationStart),
      weighInEndDate: toEndOfDayUtc(registrationEnd),
      competitionStartDate: toStartOfDayUtc(competitionStart),
      competitionEndDate: toEndOfDayUtc(competitionEnd),
      registrationOpensAt,
      registrationClosesAt,
      datesJson: {
        range: { startDate: competitionStart, endDate: competitionEnd },
        registrationDays: dates.registrationDays,
        fightDays: dates.fightDays,
        registrationWindow: {
          opensAt: registrationWindow?.opensAt ?? competitionStart,
          closesAt: registrationWindow?.closesAt ?? registrationStart,
        },
      } as Prisma.InputJsonValue,
    };
  }

  private normalizeCanonicalDates(
    dates: CanonicalDatesDto,
    timezone: string,
    registrationWindow?: { opensAt: string; closesAt?: string },
  ) {
    const registrationStartDate = new Date(dates.registrationStartDate);
    const registrationEndDate = new Date(dates.registrationEndDate);
    const weighInStartDate = dates.weighInStartDate
      ? new Date(dates.weighInStartDate)
      : null;
    const weighInEndDate = dates.weighInEndDate
      ? new Date(dates.weighInEndDate)
      : null;
    const competitionStartDate = new Date(dates.competitionStartDate);
    const competitionEndDate = new Date(dates.competitionEndDate);

    const competitionStartDay = formatInTimeZone(
      competitionStartDate,
      timezone,
      'yyyy-MM-dd',
    );
    const competitionEndDay = formatInTimeZone(
      competitionEndDate,
      timezone,
      'yyyy-MM-dd',
    );

    const regStartDay = formatInTimeZone(
      registrationStartDate,
      timezone,
      'yyyy-MM-dd',
    );
    const regEndDay = formatInTimeZone(
      registrationEndDate,
      timezone,
      'yyyy-MM-dd',
    );

    const weighInStartDay = weighInStartDate
      ? formatInTimeZone(weighInStartDate, timezone, 'yyyy-MM-dd')
      : null;
    const weighInEndDay = weighInEndDate
      ? formatInTimeZone(weighInEndDate, timezone, 'yyyy-MM-dd')
      : null;

    const registrationDays =
      weighInStartDay && weighInEndDay
        ? listDaysInclusive(weighInStartDay, weighInEndDay)
        : listDaysInclusive(regStartDay, regEndDay);

    const fightDays = listDaysInclusive(competitionStartDay, competitionEndDay);

    const defaultOpensDate = new Date(competitionStartDate);
    defaultOpensDate.setUTCDate(defaultOpensDate.getUTCDate() - 30);

    const registrationOpensAt = registrationWindow?.opensAt
      ? fromZonedTime(`${registrationWindow.opensAt}T00:00:00`, timezone)
      : (registrationStartDate ?? defaultOpensDate);

    const registrationClosesAt = registrationWindow?.closesAt
      ? fromZonedTime(`${registrationWindow.closesAt}T00:00:00`, timezone)
      : registrationEndDate;

    return {
      registrationStartDate,
      registrationEndDate,
      weighInStartDate,
      weighInEndDate,
      competitionStartDate,
      competitionEndDate,
      registrationOpensAt,
      registrationClosesAt,
      datesJson: {
        range: { startDate: competitionStartDay, endDate: competitionEndDay },
        registrationDays,
        fightDays,
        registrationWindow: {
          opensAt: registrationWindow?.opensAt ?? regStartDay,
          closesAt: registrationWindow?.closesAt ?? regEndDay,
        },
      } as Prisma.InputJsonValue,
    };
  }
}
