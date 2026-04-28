import type { Event, Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { CategoryTemplatesService } from '../category-templates/category-templates.service';
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

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

type EventWithCategoryTemplateId = Event & {
  categoryTemplateId: string | null;
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly categoryTemplates: CategoryTemplatesService,
    private readonly automation: EventStageAutomationService,
  ) {}

  async getById(
    eventId: string,
    organisationId: string,
  ): Promise<EventWithCategoryTemplateId | null> {
    try {
      await this.automation.maybeAutoAdvanceById(eventId);
    } catch (error) {
      this.logger.error(
        `Auto-advance check failed for event ${eventId}: ${String(error)}`,
      );
    }
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
      include: {
        categoryTemplateSnapshot: { select: { categoryTemplateId: true } },
      },
    });
    return event ? this.attachCategoryTemplateId(event) : null;
  }

  async list(organisationId: string): Promise<EventWithCategoryTemplateId[]> {
    const events = await this.prisma.event.findMany({
      where: { organisationId },
      orderBy: { competitionStartDate: 'desc' },
      include: {
        categoryTemplateSnapshot: { select: { categoryTemplateId: true } },
      },
    });
    return events.map((event) => this.attachCategoryTemplateId(event));
  }

  async listPublished(): Promise<EventWithCategoryTemplateId[]> {
    const events = await this.prisma.event.findMany({
      where: { published: true },
      orderBy: { competitionStartDate: 'desc' },
      include: {
        categoryTemplateSnapshot: { select: { categoryTemplateId: true } },
      },
    });
    return events.map((event) => this.attachCategoryTemplateId(event));
  }

  async listPublicAndRegistrable(): Promise<EventWithCategoryTemplateId[]> {
    const events = await this.prisma.event.findMany({
      orderBy: { competitionStartDate: 'desc' },
      include: {
        categoryTemplateSnapshot: { select: { categoryTemplateId: true } },
      },
    });

    return events
      .map((event) => this.attachCategoryTemplateId(event))
      .filter((event) => canDiscoverEventPublicly(event));
  }

  async getPublishedBySlug(
    slug: string,
  ): Promise<EventWithCategoryTemplateId | null> {
    const event = await this.prisma.event.findFirst({
      where: { slug, published: true },
      include: {
        categoryTemplateSnapshot: { select: { categoryTemplateId: true } },
      },
    });
    return event ? this.attachCategoryTemplateId(event) : null;
  }

  async getPublicOrRegistrableBySlug(
    slug: string,
  ): Promise<EventWithCategoryTemplateId | null> {
    const event = await this.prisma.event.findFirst({
      where: { slug },
      include: {
        categoryTemplateSnapshot: { select: { categoryTemplateId: true } },
      },
    });
    if (!event) return null;

    // Skip auto-advance for LIVE events — the only LIVE transition is to
    // COMPLETED at end of competition day, which the hourly cron handles.
    // Calling maybeAutoAdvanceById on every live-page poll adds 2 extra DB
    // round-trips for no benefit during an active competition.
    if (event.lifecycle !== 'LIVE') {
      try {
        await this.automation.maybeAutoAdvanceById(event.id);
      } catch (error) {
        this.logger.error(
          `Auto-advance check failed for event ${event.id}: ${String(error)}`,
        );
      }
    }

    const mapped = this.attachCategoryTemplateId(event);
    return canDiscoverEventPublicly(mapped) ? mapped : null;
  }

  async create(
    organisationId: string,
    actorUserId: string,
    dto: CreateEventDto,
  ): Promise<EventWithCategoryTemplateId> {
    const { name, nameKa, slug, location, timezone, autoAdvanceStage, policies } = dto;
    const normalized = this.normalizeDates(dto, timezone);
    const resolvedPolicies = resolveEventPolicies(policies);
    const requestedCategoryTemplateId = dto.categoryTemplateId ?? dto.rulesetId;
    const selectedCategoryTemplate = requestedCategoryTemplateId
      ? await this.categoryTemplates.getForEventSelection(
          organisationId,
          requestedCategoryTemplateId,
        )
      : await this.categoryTemplates.getActive(organisationId);
    if (!selectedCategoryTemplate) {
      throw new Error(
        requestedCategoryTemplateId
          ? 'CATEGORY_TEMPLATE_NOT_FOUND'
          : 'CATEGORY_TEMPLATE_SELECTION_REQUIRED',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          organisation: { connect: { id: organisationId } },
          name,
          nameKa: nameKa?.trim() || null,
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

      await tx.eventCategoryTemplateSnapshot.create({
        data: {
          eventId: event.id,
          categoryTemplateId: selectedCategoryTemplate.id,
          version: selectedCategoryTemplate.version,
          snapshot: selectedCategoryTemplate.definition as Prisma.InputJsonValue,
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

      return {
        ...event,
        categoryTemplateId: selectedCategoryTemplate.id,
      };
    });
  }

  async update(
    eventId: string,
    organisationId: string,
    actorUserId: string,
    dto: UpdateEventDto,
  ): Promise<EventWithCategoryTemplateId> {
    const existing = await this.getById(eventId, organisationId);
    if (!existing) throw new Error('EVENT_NOT_FOUND');

    const { name, nameKa, slug, location, timezone, autoAdvanceStage, policies } = dto;
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
          nameKa: nameKa?.trim() || null,
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

      return {
        ...updated,
        categoryTemplateId: existing.categoryTemplateId,
      };
    });
  }

  private attachCategoryTemplateId(
    event: Event & {
      categoryTemplateSnapshot?: { categoryTemplateId: string } | null;
    },
  ): EventWithCategoryTemplateId {
    const { categoryTemplateSnapshot, ...rest } = event;
    return {
      ...rest,
      categoryTemplateId: categoryTemplateSnapshot?.categoryTemplateId ?? null,
    };
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
      : toStartOfDayUtc(addDays(competitionStart, -1));

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
          closesAt: registrationWindow?.closesAt ?? addDays(competitionStart, -1),
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
