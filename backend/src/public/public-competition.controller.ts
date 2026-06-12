import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import type { Event } from '@prisma/client';
import { BracketsService } from '../draw/brackets.service';
import type {
  BracketParticipantView,
  BracketRoundColumn,
} from '../draw/brackets.types';
import { EventsService } from '../events/events.service';
import { canViewCompetitionDataPublicly } from '../events/public-event-access';
import { FightsService } from '../fights/fights.service';
import { deriveLiveQueueBoard } from '../fights/live-queue.logic';
import { PrismaService } from '../prisma/prisma.service';
import { PublicResultsService } from './public-results.service';
import { ScheduleService } from '../schedule/schedule.service';
import { resolvePublicOrg } from '../common/public-org';
import { SkipThrottle } from '@nestjs/throttler';
import { CACHE_LONG, CACHE_NONE, CACHE_SHORT } from './public-cache';

// Public spectator endpoints (brackets/schedule/live/results). Same reasoning
// as PublicController: exempt from the strict 'short' bucket so normal viewing
// — including live pages that poll — doesn't 429. 'default' (120/min) still
// applies. See PublicController for the full rationale.
@SkipThrottle({ short: true })
@Controller('public')
export class PublicCompetitionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly brackets: BracketsService,
    private readonly schedule: ScheduleService,
    private readonly fights: FightsService,
    private readonly publicResults: PublicResultsService,
  ) {}

  private async getAccessibleCompetitionEvent(eventSlug: string) {
    if (!eventSlug) {
      throw new HttpException('EVENT_SLUG_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const org = await resolvePublicOrg(this.prisma);
    if (!org) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const event = await this.events.getPublicOrRegistrableBySlug(
      eventSlug,
      org.id,
    );
    if (!event) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    this.assertCompetitionDataPublished(event);
    return event;
  }

  private assertCompetitionDataPublished(
    event: Pick<Event, 'published'>,
  ): void {
    if (!canViewCompetitionDataPublicly(event)) {
      throw new HttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
  }

  @Get('brackets/overview')
  @Header('Cache-Control', CACHE_LONG)
  async getPublicBracketsOverview(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);
    const overview = await this.brackets.getOverview({
      organisationId: event.organisationId,
      eventId: event.id,
    });
    const visibleCategories = overview.categories.filter(
      (row) => row.fightCount > 0,
    );

    return {
      event: {
        id: overview.event.id,
        name: overview.event.name,
        slug: event.slug,
        lifecycle: overview.event.lifecycle,
        drawStatus: overview.event.drawStatus,
        published: overview.event.published,
      },
      summary: {
        categoriesWithBrackets: visibleCategories.length,
        totalAthletesInBrackets: overview.summary.totalAthletesInBrackets,
        totalByes: overview.summary.totalByes,
        movedUpAthletesCount: overview.summary.movedUpAthletesCount,
      },
      lastUpdatedAt: overview.lastUpdated.at,
      categories: visibleCategories,
    };
  }

  @Get('brackets/category')
  @Header('Cache-Control', CACHE_LONG)
  async getPublicBracketCategory(
    @Query('eventSlug') eventSlug: string,
    @Query('eventWeightCategoryId') eventWeightCategoryId: string,
  ) {
    if (!eventSlug || !eventWeightCategoryId) {
      throw new HttpException(
        'eventSlug_and_eventWeightCategoryId_REQUIRED',
        HttpStatus.BAD_REQUEST,
      );
    }

    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    try {
      const details = await this.brackets.getCategoryDetails({
        organisationId: event.organisationId,
        eventId: event.id,
        eventWeightCategoryId,
      });

      if (details.category.fightCount <= 0) {
        throw new HttpException('BRACKET_NOT_GENERATED', HttpStatus.NOT_FOUND);
      }

      return {
        event: {
          id: details.event.id,
          name: details.event.name,
          slug: event.slug,
          lifecycle: details.event.lifecycle,
          drawStatus: details.event.drawStatus,
          published: details.event.published,
        },
        category: details.category,
        summary: details.summary,
        rounds: this.redactParticipantDocumentIds(details.rounds),
        fights: details.fights,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'CATEGORY_NOT_FOUND') {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('brackets')
  @Header('Cache-Control', CACHE_LONG)
  async getPublicBrackets(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.prisma.bracket.findMany({
      where: { organisationId: event.organisationId, eventId: event.id },
      include: {
        fights: {
          include: {
            redAthlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                firstNameKa: true,
                lastNameKa: true,
              },
            },
            blueAthlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                firstNameKa: true,
                lastNameKa: true,
              },
            },
            winnerAthlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                firstNameKa: true,
                lastNameKa: true,
              },
            },
          },
          orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
        },
      },
      orderBy: { categoryCode: 'asc' },
    });
  }

  // GET /api/public/weighin-results?eventSlug= — confirmed weigh-in weights
  // grouped by category. Gated on the dedicated Event.weighInResultsPublic flag
  // (NOT the general published gate): an organiser may publish weights before
  // brackets go public. Document IDs are never exposed here (privacy) — only
  // name, club, category and weight.
  @Get('weighin-results')
  @Header('Cache-Control', CACHE_SHORT)
  async getPublicWeighInResults(@Query('eventSlug') eventSlug: string) {
    if (!eventSlug) {
      throw new HttpException('EVENT_SLUG_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const org = await resolvePublicOrg(this.prisma);
    if (!org) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    const event = await this.events.getPublicOrRegistrableBySlug(
      eventSlug,
      org.id,
    );
    if (!event || !event.weighInResultsPublic) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        organisationId: event.organisationId,
        eventId: event.id,
        status: 'APPROVED',
        weighInStatus: { in: ['PASSED', 'MOVED_UP', 'OVERRIDE_APPROVED'] },
        eventWeightCategoryId: { not: null },
      },
      select: {
        athleteId: true,
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            firstNameKa: true,
            lastNameKa: true,
          },
        },
        club: { select: { name: true, nameKa: true } },
        eventWeightCategory: {
          select: {
            id: true,
            categoryTemplateWeight: { select: { name: true, sortOrder: true } },
            eventAgeGroup: {
              select: {
                categoryTemplateAgeGroup: {
                  select: { name: true, sex: true, sortOrder: true },
                },
              },
            },
          },
        },
        weighIns: {
          select: { weightKg: true },
          orderBy: { attemptNo: 'desc' },
          take: 1,
        },
      },
    });

    type WeighInCategoryBucket = {
      id: string;
      categoryName: string;
      ageGroupName: string;
      division: string | null;
      weightSortOrder: number;
      ageGroupSortOrder: number;
      athletes: Array<{
        athleteId: string;
        firstName: string;
        lastName: string;
        firstNameKa: string | null;
        lastNameKa: string | null;
        clubName: string | null;
        clubNameKa: string | null;
        weightKg: number | null;
      }>;
    };

    const buckets = new Map<string, WeighInCategoryBucket>();
    for (const reg of registrations) {
      const cat = reg.eventWeightCategory;
      if (!cat) continue;
      const ageGroup = cat.eventAgeGroup.categoryTemplateAgeGroup;
      let bucket = buckets.get(cat.id);
      if (!bucket) {
        bucket = {
          id: cat.id,
          categoryName: cat.categoryTemplateWeight.name,
          ageGroupName: ageGroup.name,
          division: ageGroup.sex,
          weightSortOrder: cat.categoryTemplateWeight.sortOrder,
          ageGroupSortOrder: ageGroup.sortOrder,
          athletes: [],
        };
        buckets.set(cat.id, bucket);
      }
      bucket.athletes.push({
        athleteId: reg.athlete.id,
        firstName: reg.athlete.firstName,
        lastName: reg.athlete.lastName,
        firstNameKa: reg.athlete.firstNameKa,
        lastNameKa: reg.athlete.lastNameKa,
        clubName: reg.club?.name ?? null,
        clubNameKa: reg.club?.nameKa ?? null,
        weightKg: reg.weighIns[0]?.weightKg ?? null,
      });
    }

    const categories = [...buckets.values()]
      .sort(
        (a, b) =>
          a.ageGroupSortOrder - b.ageGroupSortOrder ||
          a.weightSortOrder - b.weightSortOrder ||
          a.categoryName.localeCompare(b.categoryName),
      )
      .map((bucket) => ({
        id: bucket.id,
        categoryName: bucket.categoryName,
        ageGroupName: bucket.ageGroupName,
        division: bucket.division,
        athletes: bucket.athletes.sort(
          (a, b) =>
            (a.weightKg ?? Number.POSITIVE_INFINITY) -
              (b.weightKg ?? Number.POSITIVE_INFINITY) ||
            a.lastName.localeCompare(b.lastName),
        ),
      }));

    return {
      event: {
        id: event.id,
        name: event.name,
        nameKa: event.nameKa,
        slug: event.slug,
      },
      categories,
    };
  }

  @Get('schedule')
  @Header('Cache-Control', CACHE_SHORT)
  async getPublicSchedule(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.schedule.getSchedule({
      organisationId: event.organisationId,
      eventId: event.id,
    });
  }

  @Get('schedule-sessions')
  @Header('Cache-Control', CACHE_SHORT)
  async getPublicScheduleSessions(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.schedule.listSessions(event.organisationId, event.id);
  }

  @Get('event-schedule')
  @Header('Cache-Control', CACHE_SHORT)
  async getPublicEventSchedule(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);
    return this.schedule.getEventSchedule({
      organisationId: event.organisationId,
      eventId: event.id,
    });
  }

  @Get('live')
  @Header('Cache-Control', CACHE_SHORT)
  async getPublicLive(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);
    const board = await this.fights.getLiveQueueBoard({
      organisationId: event.organisationId,
      eventId: event.id,
    });

    return {
      eventId: event.id,
      current: board.currentFight ?? null,
      onDeck: board.onDeckFight ?? null,
      upNext: board.nextFights,
      queuePreview: board.queuePreview,
      latestResult: board.completedFights[0] ?? null,
    };
  }

  @Get('results')
  @Header('Cache-Control', CACHE_LONG)
  async getPublicResults(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.publicResults.getEventResults({
      eventId: event.id,
      organisationId: event.organisationId,
      bronzePolicyCode: event.bronzePolicyCode,
    });
  }

  @Get('mat')
  @Header('Cache-Control', CACHE_NONE)
  async getMatFeed(
    @Query('eventSlug') eventSlug: string,
    @Query('mat') matName: string,
  ) {
    if (!eventSlug || !matName) {
      throw new HttpException(
        'eventSlug and mat are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const event = await this.getAccessibleCompetitionEvent(eventSlug);
    const mat = await this.prisma.mat.findFirst({
      where: {
        organisationId: event.organisationId,
        eventId: event.id,
        name: { equals: matName, mode: 'insensitive' },
      },
    });

    if (!mat) {
      throw new HttpException('Mat not found', HttpStatus.NOT_FOUND);
    }

    const scheduleRows = await this.schedule.getSchedule({
      organisationId: event.organisationId,
      eventId: event.id,
      matId: mat.id,
    });
    const fights = await this.prisma.fight.findMany({
      where: {
        organisationId: event.organisationId,
        eventId: event.id,
        id: { in: scheduleRows.map((row) => row.id) },
      },
      include: {
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        timerState: true,
      },
      orderBy: { orderInMat: 'asc' },
    });

    const fightById = new Map(fights.map((fight) => [fight.id, fight]));
    const orderedFights = scheduleRows
      .map((row) => fightById.get(row.id))
      .filter((fight): fight is (typeof fights)[number] => Boolean(fight));
    const board = deriveLiveQueueBoard(
      scheduleRows.map((row) => ({
        ...row,
        sessionOrder: null,
        orderInSession: row.orderInSession,
        isFinished: row.status === 'COMPLETE' || row.status === 'CONFIRMED',
      })),
    );

    return {
      eventId: event.id,
      mat: { id: mat.id, name: mat.name },
      now: board.current ? (fightById.get(board.current.id) ?? null) : null,
      onDeck: board.onDeck ? (fightById.get(board.onDeck.id) ?? null) : null,
      next: board.next
        .map((row) => fightById.get(row.id))
        .filter((fight): fight is (typeof fights)[number] => Boolean(fight))
        .slice(0, 3),
      fights: orderedFights,
    };
  }

  /**
   * Replaces athleteCode (which contains documentId / national ID) with the
   * athlete's UUID before returning bracket data to unauthenticated callers.
   * Admin/coach routes use getCategoryDetails directly and retain the full value.
   */
  private redactParticipantDocumentIds(
    rounds: BracketRoundColumn[],
  ): BracketRoundColumn[] {
    const redact = (p: BracketParticipantView | null) =>
      p ? { ...p, athleteCode: p.athleteId } : null;

    return rounds.map((round) => ({
      ...round,
      matchups: round.matchups.map((matchup) => ({
        ...matchup,
        participants: {
          red: redact(matchup.participants.red),
          blue: redact(matchup.participants.blue),
        },
        slots: {
          red: {
            ...matchup.slots.red,
            athlete: redact(matchup.slots.red.athlete),
          },
          blue: {
            ...matchup.slots.blue,
            athlete: redact(matchup.slots.blue.athlete),
          },
        },
      })),
    }));
  }
}
