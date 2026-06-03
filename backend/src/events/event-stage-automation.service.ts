import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { formatInTimeZone, toZonedTime, format } from 'date-fns-tz';
import type { EventLifecycle, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { getRegistrationStatus } from './event-dates.helper';
import {
  isFinalWeighInStatus,
  isWeighInComplete,
} from './weighin-completion.helper';

// Loose shape for the JSON `dates` blob on an Event row. We only need
// registrationDays here; the index signature keeps TS happy with whatever
// else might live on the blob.
interface EventDates {
  registrationDays?: string[];
  [key: string]: unknown;
}

// Minimal row shape we need to make an auto-advance decision. Pulled with a
// narrow `select` so we don't drag the entire Event row through this hot path.
type EventCandidate = {
  id: string;
  name: string;
  timezone: string;
  lifecycle: EventLifecycle;
  autoAdvanceStage: boolean;
  organisationId: string;
  dates: unknown;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  registrationEndDate: Date;
  weighInStartDate: Date | null;
  competitionStartDate: Date;
  competitionEndDate: Date;
};

// Background service that walks events through their lifecycle automatically
// based on dates and weigh-in completion. Drives the system without admin
// intervention so events naturally REG_OPEN → LOCKED → WEIGHIN → ... → COMPLETED.
// Runs hourly via cron and also opportunistically from EventsService reads.
@Injectable()
export class EventStageAutomationService {
  private readonly logger = new Logger(EventStageAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Runs at minute 5 of every hour (e.g. 00:05, 01:05 …) */
  // Cron entry point — scheduled via NestScheduleModule wired in AppModule.
  // Picked an off-hour offset (xx:05) to avoid clashing with other periodic
  // jobs that tend to run on the hour.
  @Cron('0 5 * * * *')
  async runHourlyCheck(): Promise<void> {
    await this.checkAndAdvanceStages();
  }

  /**
   * Check a single specific event and advance it if conditions are met.
   * Used in read endpoints so pages are always up-to-date, even if cron missed a run.
   */
  // Opportunistic single-event check called from EventsService.getById and
  // getPublicOrRegistrableBySlug. Cheap enough (one indexed read + maybe one
  // updateMany) that running it on each page load keeps the UI in sync without
  // waiting for the next hourly cron tick.
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
        registrationOpensAt: true,
        registrationClosesAt: true,
        registrationEndDate: true,
        weighInStartDate: true,
        competitionStartDate: true,
        competitionEndDate: true,
      },
    });

    if (!event) return;

    await this.tryAdvanceEventRecord(event);
  }

  /**
   * Scan all events eligible for auto-advance and apply transitions.
   * Called by the hourly cron and by the admin "run now" endpoint.
   */
  // Filter: events where autoAdvanceStage=true AND lifecycle is one we can
  // auto-progress, plus WEIGHIN and LIVE which always need evaluation (weigh-in
  // completion + end-of-competition-day don't depend on autoAdvanceStage).
  // Returns the number of events that actually changed lifecycle.
  async checkAndAdvanceStages(organisationId?: string): Promise<number> {
    const candidates = await this.prisma.event.findMany({
      where: {
        ...(organisationId ? { organisationId } : {}),
        OR: [
          {
            autoAdvanceStage: true,
            lifecycle: {
              in: [
                'REG_OPEN',
                'LOCKED',
                'WEIGH_IN_COMPLETED',
                'DRAWN',
                'PUBLISHED',
              ],
            },
          },
          { lifecycle: 'WEIGHIN' },
          { lifecycle: 'LIVE' },
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
        registrationOpensAt: true,
        registrationClosesAt: true,
        registrationEndDate: true,
        weighInStartDate: true,
        competitionStartDate: true,
        competitionEndDate: true,
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
  // Per-state rules, in order:
  //   REG_OPEN              → LOCKED                when registration window is CLOSED
  //   LOCKED                → WEIGHIN               when today >= weighInStartDate
  //   WEIGHIN               → WEIGH_IN_COMPLETED    when every non-withdrawn registration has a final status
  //   WEIGH_IN_COMPLETED    → DRAWN                 unconditionally (just gates publish)
  //   DRAWN | PUBLISHED     → LIVE                  when today >= competitionStartDate
  //   LIVE                  → COMPLETED             when today > competitionEndDate
  // All date comparisons happen in the event's timezone (fallback Asia/Tbilisi).
  // Errors are swallowed and logged — never block other events in the loop.
  private async tryAdvanceEventRecord(event: EventCandidate): Promise<boolean> {
    try {
      const timezone = event.timezone || 'Asia/Tbilisi';
      const todayStr = this.getTodayInTimezone(timezone);
      // Assumption: if online registration close is not configured, use
      // registrationEndDate as deterministic fallback lock boundary.
      if (
        event.lifecycle === 'REG_OPEN' &&
        event.autoAdvanceStage &&
        getRegistrationStatus(event) === 'CLOSED'
      ) {
        return this.advanceLifecycle({
          event,
          from: 'REG_OPEN',
          to: 'LOCKED',
          reason: 'Auto-advance: registration close day has passed',
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
        // BF-7: settle any lapsed reweigh / one-hour windows first, otherwise a
        // stalled non-final REWEIGH_ALLOWED status blocks completion forever.
        await this.resolveExpiredReweighWindows(event.id, event.organisationId);
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

      const competitionStartStr = formatInTimeZone(
        event.competitionStartDate,
        timezone,
        'yyyy-MM-dd',
      );

      if (
        (event.lifecycle === 'DRAWN' || event.lifecycle === 'PUBLISHED') &&
        event.autoAdvanceStage &&
        todayStr >= competitionStartStr
      ) {
        return this.advanceLifecycle({
          event,
          from: event.lifecycle,
          to: 'LIVE',
          reason: `Auto-advance: today (${todayStr}) >= competitionStartDate (${competitionStartStr}) tz=${timezone}`,
        });
      }

      if (event.lifecycle === 'LIVE' && event.autoAdvanceStage) {
        const competitionEndStr = formatInTimeZone(
          event.competitionEndDate,
          timezone,
          'yyyy-MM-dd',
        );
        if (todayStr > competitionEndStr) {
          return this.advanceLifecycle({
            event,
            from: 'LIVE',
            to: 'COMPLETED',
            reason: `Auto-advance: today (${todayStr}) > competitionEndDate (${competitionEndStr}) tz=${timezone}`,
          });
        }
        return false;
      }

      return false;
    } catch (err) {
      this.logger.error(
        `Error auto-advancing event "${event.name}" (${event.id}): ${String(err)}`,
      );
      return false;
    }
  }

  // True when every non-withdrawn registration for this event has reached a
  // final weigh-in status (PASSED / FAILED / etc.). On false, logs a debug
  // sample of the holdouts so admins can see which registrations are blocking
  // the WEIGHIN → WEIGH_IN_COMPLETED transition.
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

  // BF-7: a reweigh / one-hour window that lapsed without resolution leaves the
  // registration parked in the non-final REWEIGH_ALLOWED state, which blocks
  // WEIGHIN → WEIGH_IN_COMPLETED indefinitely (and there is no operator action
  // that auto-fires at the deadline). Auto-resolve every expired window to its
  // terminal decision (DISQUALIFIED) so a stalled reweigh can't freeze the event.
  private async resolveExpiredReweighWindows(
    eventId: string,
    organisationId: string,
  ): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.weighInAttempt.findMany({
      where: {
        eventId,
        organisationId,
        decision: { in: ['ONE_HOUR', 'REWEIGH'] },
        resolvedAt: null,
        deadlineAt: { not: null, lt: now },
        registration: { weighInStatus: 'REWEIGH_ALLOWED' },
      },
      select: { id: true, registrationId: true },
    });

    let resolved = 0;
    for (const attempt of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Re-check inside the tx so we never clobber a window an operator
          // settled between our read and this write.
          const fresh = await tx.weighInAttempt.findFirst({
            where: {
              id: attempt.id,
              resolvedAt: null,
              registration: { weighInStatus: 'REWEIGH_ALLOWED' },
            },
            select: { id: true },
          });
          if (!fresh) return;

          await tx.weighInAttempt.update({
            where: { id: attempt.id },
            data: { resolvedAt: now, resolvedAction: 'AUTO_DQ_DEADLINE' },
          });
          await tx.registration.update({
            where: { id: attempt.registrationId },
            data: { status: 'REJECTED', weighInStatus: 'DISQUALIFIED' },
          });
          await this.audit.write(
            {
              organisationId,
              eventId,
              actorUserId: null,
              action: 'WEIGHIN_REWEIGH_DEADLINE_AUTO_DQ',
              entityType: 'weighin',
              entityId: attempt.id,
              before: null,
              after: {
                reason: 'reweigh window expired',
              } as unknown as Prisma.JsonValue,
              reason: 'Auto-DQ: reweigh deadline passed with no resolution',
              override: true,
            },
            tx,
          );
          resolved += 1;
        });
      } catch (err) {
        this.logger.error(
          `Failed to auto-resolve expired reweigh attempt ${attempt.id}: ${String(err)}`,
        );
      }
    }

    if (resolved > 0) {
      this.logger.log(
        `Auto-resolved ${resolved} expired reweigh window(s) for event ${eventId}`,
      );
    }
    return resolved;
  }

  // Resolve the start-of-weigh-in day (YYYY-MM-DD) for this event in its
  // timezone. Prefers the canonical weighInStartDate column; falls back to the
  // earliest entry in dates.registrationDays for older events that still use
  // the legacy JSON-blob date format.
  private getWeighInStartDate(
    event: EventCandidate,
    timezone: string,
  ): string | null {
    if (event.weighInStartDate) {
      return formatInTimeZone(event.weighInStartDate, timezone, 'yyyy-MM-dd');
    }

    const weighInDays = this.extractWeighInDays(event.dates);
    if (!weighInDays || weighInDays.length === 0) return null;
    return [...weighInDays].sort()[0];
  }

  // Single point of mutation for auto-advance. Uses updateMany with both id
  // AND from-lifecycle in the where-clause as an optimistic lock: if another
  // process raced us and already moved the event past `from`, the update
  // affects 0 rows and we silently bail. Always writes an audit row attributing
  // the change to no user (actorUserId=null) so it's clearly system-driven.
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

  // Defensive parse of the legacy JSON `dates` blob to pull out
  // registrationDays. Returns null when the blob is missing, malformed, or
  // has an empty registrationDays array.
  private extractWeighInDays(dates: unknown): string[] | null {
    if (!dates || typeof dates !== 'object') return null;
    const d = dates as EventDates;
    if (!Array.isArray(d.registrationDays) || d.registrationDays.length === 0)
      return null;
    return d.registrationDays;
  }

  // Today's date as a YYYY-MM-DD string in the event's local timezone.
  // Public (not private) because lifecycle.spec.ts and other tests mock or
  // call it to drive deterministic clock scenarios.
  getTodayInTimezone(timezone: string): string {
    const zonedNow = toZonedTime(new Date(), timezone);
    return format(zonedNow, 'yyyy-MM-dd', { timeZone: timezone });
  }
}
