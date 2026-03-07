import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { toZonedTime, format } from 'date-fns-tz';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

interface EventDates {
  registrationDays?: string[];
  [key: string]: unknown;
}

type EventCandidate = {
  id: string;
  name: string;
  timezone: string;
  lifecycle: string;
  autoAdvanceStage: boolean;
  organisationId: string;
  dates: unknown;
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
      },
    });

    if (!event) return;
    if (!event.autoAdvanceStage || event.lifecycle !== 'REG_OPEN') return;

    await this.tryAdvanceEventRecord(event);
  }

  /**
   * Scan all events eligible for auto-advance and apply transitions.
   * Called by the hourly cron and by the admin "run now" endpoint.
   */
  async checkAndAdvanceStages(): Promise<number> {
    const candidates = await this.prisma.event.findMany({
      where: { autoAdvanceStage: true, lifecycle: 'REG_OPEN' },
      select: {
        id: true,
        name: true,
        timezone: true,
        lifecycle: true,
        autoAdvanceStage: true,
        organisationId: true,
        dates: true,
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
      const weighInDays = this.extractWeighInDays(event.dates);

      if (!weighInDays || weighInDays.length === 0) {
        this.logger.warn(
          `Event "${event.name}" (${event.id}) has no weighInDays — skipping auto-advance`,
        );
        return false;
      }

      const timezone = event.timezone || 'Asia/Tbilisi';
      const todayStr = this.getTodayInTimezone(timezone);
      const weighInStartDate = [...weighInDays].sort()[0];

      if (todayStr < weighInStartDate) {
        return false;
      }

      // Conditional update — concurrency-safe: only proceeds if stage is still REG_OPEN
      const result = await this.prisma.event.updateMany({
        where: { id: event.id, lifecycle: 'REG_OPEN' },
        data: { lifecycle: 'WEIGHIN' },
      });

      if (result.count === 0) {
        // Another process already advanced it
        return false;
      }

      this.logger.log(
        `Auto-advanced event "${event.name}" (${event.id}) ` +
          `REG_OPEN → WEIGHIN | today=${todayStr} weighInStart=${weighInStartDate} tz=${timezone}`,
      );

      await this.audit.write({
        organisationId: event.organisationId,
        eventId: event.id,
        actorUserId: null,
        action: 'EVENT_STAGE_AUTO_ADVANCED',
        entityType: 'event',
        entityId: event.id,
        before: { lifecycle: 'REG_OPEN' } as Prisma.JsonValue,
        after: { lifecycle: 'WEIGHIN' } as Prisma.JsonValue,
        reason: `Auto-advance: today (${todayStr}) >= weighInStartDate (${weighInStartDate}) tz=${timezone}`,
      });

      return true;
    } catch (err) {
      this.logger.error(
        `Error auto-advancing event "${event.name}" (${event.id}): ${String(err)}`,
      );
      return false;
    }
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
