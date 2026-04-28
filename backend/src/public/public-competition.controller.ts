import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import type { Event } from '@prisma/client';
import { BracketsService } from '../draw/brackets.service';
import { EventsService } from '../events/events.service';
import { canViewCompetitionDataPublicly } from '../events/public-event-access';
import { FightsService } from '../fights/fights.service';
import { deriveLiveQueueBoard } from '../fights/live-queue.logic';
import { PrismaService } from '../prisma/prisma.service';
import { PublicResultsService } from './public-results.service';
import { ScheduleService } from '../schedule/schedule.service';

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
      throw new HttpException('eventSlug_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
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
        rounds: details.rounds,
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
  async getPublicBrackets(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.prisma.bracket.findMany({
      where: { eventId: event.id },
      include: {
        fights: {
          include: {
            redAthlete: {
              select: { id: true, firstName: true, lastName: true, firstNameKa: true, lastNameKa: true },
            },
            blueAthlete: {
              select: { id: true, firstName: true, lastName: true, firstNameKa: true, lastNameKa: true },
            },
            winnerAthlete: {
              select: { id: true, firstName: true, lastName: true, firstNameKa: true, lastNameKa: true },
            },
          },
          orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
        },
      },
      orderBy: { categoryCode: 'asc' },
    });
  }

  @Get('schedule')
  async getPublicSchedule(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.schedule.getSchedule({
      organisationId: event.organisationId,
      eventId: event.id,
    });
  }

  @Get('schedule-sessions')
  async getPublicScheduleSessions(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.schedule.listSessions(event.organisationId, event.id);
  }

  @Get('event-schedule')
  async getPublicEventSchedule(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);
    return this.schedule.getEventSchedule({
      organisationId: event.organisationId,
      eventId: event.id,
    });
  }

  @Get('live')
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
  async getPublicResults(@Query('eventSlug') eventSlug: string) {
    const event = await this.getAccessibleCompetitionEvent(eventSlug);

    return this.publicResults.getEventResults({
      eventId: event.id,
      organisationId: event.organisationId,
      bronzePolicyCode: event.bronzePolicyCode,
    });
  }

  @Get('mat')
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
}
