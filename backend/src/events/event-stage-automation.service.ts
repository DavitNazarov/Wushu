import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { formatInTimeZone, toZonedTime, format } from 'date-fns-tz';
import type { EventLifecycle, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import {
  isFinalWeighInStatus,
  isWeighInComplete,
} from './weighin-completion.helper';

interface EventDates {
  registrationDays?: string[];
  [key: string]: unknown;
}

type EventCandidate = {
  id: string;
  name: string;
  timezone: string;
  lifecycle: EventLifecycle;
  autoAdvanceStage: boolean;
  organisationId: string;
  dates: unknown;
  registrationClosesAt: Date | null;
  registrationEndDate: Date;
  weighInStartDate: Date | null;
};

@Injectable()
export class EventStageAutomationService {
  private readonly logger = new Logger(EventStageAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Runs at minute 5 of every hour (e.g. 00:05, 01:05 …) */
  @Cron('0 5 * * * *')
  async runHourlyCheck(): Promise<void> {
    await this.checkAndAdvanceStages();
  }

  /**
   * Check a single specific event and advance it if conditions are met.
   * Used in read endpoints so pages are always up-to-date, even if cron missed a run.
   */
  async maybeAutoAdvanceById(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        timezone: true,
        lifecycle: true,
        autoAdvanceStage: true,
        organisationId: true,
        dates: true,
        registrationClosesAt: true,
        registrationEndDate: true,
        weighInStartDate: true,
      },
    });

    if (!event) return;

    await this.tryAdvanceEventRecord(event);
  }

  /**
   * Scan all events eligible for auto-advance and apply transitions.
   * Called by the hourly cron and by the admin "run now" endpoint.
   */
  async checkAndAdvanceStages(): Promise<number> {
    const candidates = await this.prisma.event.findMany({
      where: {
        OR: [
          {
            autoAdvanceStage: true,
            lifecycle: {
              in: ['REG_OPEN', 'LOCKED', 'WEIGH_IN_COMPLETED'],
            },
          },
          {
            lifecycle: 'WEIGHIN',
          },
        ],
      },
      select: {
        id: true,
        name: true,
        timezone: true,
        lifecycle: true,
        autoAdvanceStage: true,
        organisationId: true,
        dates: true,
        registrationClosesAt: true,
        registrationEndDate: true,
        weighInStartDate: true,
      },
    });

    let advanced = 0;
    for (const event of candidates) {
      const didAdvance = await this.tryAdvanceEventRecord(event);
      if (didAdvance) advanced++;
    }

    if (advanced > 0) {
      this.logger.log(
        `Auto-advance run complete: ${advanced} event(s) advanced`,
      );
    }

    return advanced;
  }

  /**
   * Core logic: evaluate one event and update stage if conditions are met.
   * Returns true if the stage was changed.
   */
  private async tryAdvanceEventRecord(event: EventCandidate): Promise<boolean> {
    try {
      const timezone = event.timezone || 'Asia/Tbilisi';
      const todayStr = this.getTodayInTimezone(timezone);
      // Assumption: if online registration close is not configured, use
      // registrationEndDate as deterministic fallback lock boundary.
      const registrationCloseAt =
        event.registrationClosesAt ?? event.registrationEndDate;

      if (
        event.lifecycle === 'REG_OPEN' &&
        event.autoAdvanceStage &&
        registrationCloseAt &&
        new Date() > registrationCloseAt
      ) {
        return this.advanceLifecycle({
          event,
          from: 'REG_OPEN',
          to: 'LOCKED',
          reason: `Auto-advance: registration close passed (${registrationCloseAt.toISOString()})`,
        });
      }

      if (event.lifecycle === 'LOCKED' && event.autoAdvanceStage) {
        const weighInStartDate = this.getWeighInStartDate(event, timezone);
        if (!weighInStartDate) {
          this.logger.warn(
            `Event "${event.name}" (${event.id}) has no weighInStartDate — skipping LOCKED → WEIGHIN auto-advance`,
          );
          return false;
        }

        if (todayStr < weighInStartDate) {
          return false;
        }

        return this.advanceLifecycle({
          event,
          from: 'LOCKED',
          to: 'WEIGHIN',
          reason: `Auto-advance: today (${todayStr}) >= weighInStartDate (${weighInStartDate}) tz=${timezone}`,
        });
      }

      if (event.lifecycle === 'WEIGHIN') {
        const completed = await this.hasCompletedWeighIn(event.id);
        if (!completed) return false;

        return this.advanceLifecycle({
          event,
          from: 'WEIGHIN',
          to: 'WEIGH_IN_COMPLETED',
          reason: 'Auto-advance: all athletes have final weigh-in statuses',
        });
      }

      if (event.lifecycle === 'WEIGH_IN_COMPLETED') {
        if (!event.autoAdvanceStage) return false;
        return this.advanceLifecycle({
          event,
          from: 'WEIGH_IN_COMPLETED',
          to: 'DRAWN',
          reason: 'Auto-advance: weigh-in completed',
        });
      }

      return false;
    } catch (err) {
      this.logger.error(
        `Error auto-advancing event "${event.name}" (${event.id}): ${String(err)}`,
      );
      return false;
    }
  }

  private async hasCompletedWeighIn(eventId: string): Promise<boolean> {
    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId,
        status: { not: 'WITHDRAWN' },
      },
      select: {
        id: true,
        weighInStatus: true,
      },
    });

    const complete = isWeighInComplete(
      registrations.map((registration) => registration.weighInStatus),
    );
    if (!complete) {
      const nonFinalRegistrations = registrations.filter(
        (registration) => !isFinalWeighInStatus(registration.weighInStatus),
      );
      const nonFinalSample = nonFinalRegistrations
        .slice(0, 10)
        .map((registration) => ({
          id: registration.id,
          status: registration.weighInStatus,
        }));

      this.logger.debug(
        `Weigh-in completion pending for event ${eventId}: ${JSON.stringify({
          total: registrations.length,
          nonFinalCount: nonFinalRegistrations.length,
          sampleNonFinal: nonFinalSample,
        })}`,
      );
    }

    return complete;
  }

  private getWeighInStartDate(event: EventCandidate, timezone: string): string | null {
    if (event.weighInStartDate) {
      return formatInTimeZone(event.weighInStartDate, timezone, 'yyyy-MM-dd');
    }

    const weighInDays = this.extractWeighInDays(event.dates);
    if (!weighInDays || weighInDays.length === 0) return null;
    return [...weighInDays].sort()[0];
  }

  private async advanceLifecycle(input: {
    event: EventCandidate;
    from: EventLifecycle;
    to: EventLifecycle;
    reason: string;
  }): Promise<boolean> {
    const result = await this.prisma.event.updateMany({
      where: { id: input.event.id, lifecycle: input.from },
      data: { lifecycle: input.to },
    });

    if (result.count === 0) return false;

    this.logger.log(
      `Auto-advanced event "${input.event.name}" (${input.event.id}) ${input.from} → ${input.to}`,
    );

    await this.audit.write({
      organisationId: input.event.organisationId,
      eventId: input.event.id,
      actorUserId: null,
      action: 'EVENT_STAGE_AUTO_ADVANCED',
      entityType: 'event',
      entityId: input.event.id,
      before: { lifecycle: input.from } as Prisma.JsonValue,
      after: { lifecycle: input.to } as Prisma.JsonValue,
      reason: input.reason,
    });

    return true;
  }

  private extractWeighInDays(dates: unknown): string[] | null {
    if (!dates || typeof dates !== 'object') return null;
    const d = dates as EventDates;
    if (!Array.isArray(d.registrationDays) || d.registrationDays.length === 0)
      return null;
    return d.registrationDays;
  }

  getTodayInTimezone(timezone: string): string {
    const zonedNow = toZonedTime(new Date(), timezone);
    return format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
  }
}
