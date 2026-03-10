import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Event } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { ClubsService } from '../clubs/clubs.service';
import { EventCategoriesService } from '../events/event-categories.service';
import { getRegistrationStatus } from '../events/event-dates.helper';
import { PrismaService } from '../prisma/prisma.service';
import { BracketsService } from '../draw/brackets.service';
import { ScheduleService } from '../schedule/schedule.service';
import {
  buildMedalTable,
  buildPlacementsFromConfirmedFights,
} from '../results/results.logic';
import { canViewCompetitionDataPublicly } from '../events/public-event-access';

function withRegistrationStatus(event: Event) {
  return { ...event, registrationStatus: getRegistrationStatus(event) };
}

function matchesMatName(name: string, query: string) {
  return name.localeCompare(query, undefined, { sensitivity: 'accent' }) === 0;
}

@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly clubs: ClubsService,
    private readonly eventCategories: EventCategoriesService,
    private readonly brackets: BracketsService,
    private readonly schedule: ScheduleService,
  ) {}

  private assertCompetitionDataPublished(event: Pick<Event, 'published'>): void {
    if (!canViewCompetitionDataPublicly(event)) {
      throw new HttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
  }

  @Get('events')
  async listPublishedEvents() {
    const events = await this.events.listPublicAndRegistrable();
    return events.map(withRegistrationStatus);
  }

  @Get('events/:slug')
  async getPublishedEvent(@Param('slug') slug: string) {
    const event = await this.events.getPublicOrRegistrableBySlug(slug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return withRegistrationStatus(event);
  }

  /** Public: event categories — no auth required, used by coach registration UI */
  @Get('events/:slug/categories')
  async getPublishedEventCategories(@Param('slug') slug: string) {
    const event = await this.events.getPublicOrRegistrableBySlug(slug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return this.eventCategories.getCategories(event.id, event.organisationId);
  }

  @Get('news')
  async listPublishedNews() {
    const org = await this.prisma.organisation.findFirst();
    if (!org) return [];

    return this.prisma.newsPost.findMany({
      where: { organisationId: org.id, published: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true,
        createdAt: true,
        eventId: true,
        event: { select: { id: true, name: true, slug: true, location: true } },
      },
    });
  }

  @Get('news/:slug')
  async getNewsPost(@Param('slug') slug: string) {
    const post = await this.prisma.newsPost.findFirst({
      where: { slug, published: true },
      orderBy: { publishedAt: 'desc' },
      include: {
        event: { select: { id: true, name: true, slug: true, location: true } },
      },
    });
    if (!post) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return post;
  }

  @Get('clubs')
  async listPublicClubs() {
    return this.clubs.listPublic();
  }

  @Get('brackets/overview')
  async getPublicBracketsOverview(@Query('eventSlug') eventSlug: string) {
    if (!eventSlug) {
      throw new HttpException('eventSlug_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event || !event.published) {
      throw new HttpException('BRACKETS_NOT_PUBLISHED', HttpStatus.NOT_FOUND);
    }

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

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event || !event.published) {
      throw new HttpException('BRACKETS_NOT_PUBLISHED', HttpStatus.NOT_FOUND);
    }

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
    if (!eventSlug)
      throw new HttpException('eventSlug_REQUIRED', HttpStatus.BAD_REQUEST);

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event || !event.published) {
      throw new HttpException('BRACKETS_NOT_PUBLISHED', HttpStatus.NOT_FOUND);
    }

    return this.prisma.bracket.findMany({
      where: { eventId: event.id },
      include: {
        fights: {
          include: {
            redAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
            blueAthlete: {
              select: { id: true, firstName: true, lastName: true },
            },
            winnerAthlete: {
              select: { id: true, firstName: true, lastName: true },
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
    if (!eventSlug)
      throw new HttpException('eventSlug_REQUIRED', HttpStatus.BAD_REQUEST);

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    this.assertCompetitionDataPublished(event);

    return this.schedule.getSchedule({
      organisationId: event.organisationId,
      eventId: event.id,
    });
  }

  @Get('live')
  async getPublicLive(
    @Query('eventSlug') eventSlug: string,
    @Query('mat') matName?: string,
  ) {
    if (!eventSlug) {
      throw new HttpException('eventSlug_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    this.assertCompetitionDataPublished(event);

    const scheduleRows = await this.schedule.getSchedule({
      organisationId: event.organisationId,
      eventId: event.id,
    });

    const mats = await this.prisma.mat.findMany({
      where: { organisationId: event.organisationId, eventId: event.id },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    });

    const selectedMat = matName
      ? mats.find((mat) => matchesMatName(mat.name, matName)) ?? null
      : mats[0] ?? null;

    const rows = selectedMat
      ? scheduleRows.filter((row) => row.matId === selectedMat.id)
      : scheduleRows;
    const sorted = [...rows].sort(
      (a, b) =>
        (a.scheduleOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.scheduleOrder ?? Number.MAX_SAFE_INTEGER),
    );

    const current =
      sorted.find((row) => row.liveStatus === 'RUNNING') ??
      sorted.find((row) => row.liveStatus === 'UPCOMING') ??
      null;

    const upNext = sorted.filter((row) => {
      if (!current) return row.liveStatus !== 'FINISHED';
      return (
        row.id !== current.id &&
        row.liveStatus !== 'FINISHED' &&
        (row.scheduleOrder ?? Number.MAX_SAFE_INTEGER) >
          (current.scheduleOrder ?? Number.MAX_SAFE_INTEGER)
      );
    });

    return {
      eventId: event.id,
      mats,
      selectedMatId: selectedMat?.id ?? null,
      selectedMatName: selectedMat?.name ?? null,
      current,
      upNext,
    };
  }

  @Get('results')
  async getPublicResults(@Query('eventSlug') eventSlug: string) {
    if (!eventSlug)
      throw new HttpException('eventSlug_REQUIRED', HttpStatus.BAD_REQUEST);

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    this.assertCompetitionDataPublished(event);

    const fights = await this.prisma.fight.findMany({
      where: {
        eventId: event.id,
        status: { in: ['COMPLETE', 'CONFIRMED'] },
      },
      include: {
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ categoryCode: 'asc' }, { round: 'asc' }, { boutNo: 'asc' }],
    });

    const placements = buildPlacementsFromConfirmedFights(
      fights.map((fight) => ({
        id: fight.id,
        categoryCode: fight.categoryCode,
        round: fight.round,
        boutNo: fight.boutNo,
        winnerAthleteId: fight.winnerAthleteId ?? null,
        redAthleteId: fight.redAthleteId ?? null,
        blueAthleteId: fight.blueAthleteId ?? null,
      })),
      event.bronzePolicyCode,
    );

    const registrations = await this.prisma.registration.findMany({
      where: { eventId: event.id },
      select: {
        athleteId: true,
        clubId: true,
        club: { select: { name: true } },
      },
    });
    const athleteClubById = new Map(
      registrations.map((row) => [
        row.athleteId,
        { clubId: row.clubId, clubName: row.club?.name ?? 'Unknown club' },
      ]),
    );
    const medalTable = buildMedalTable({ placements, athleteClubById });

    return { fights, placements, medalTable };
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

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    this.assertCompetitionDataPublished(event);

    const mat = await this.prisma.mat.findFirst({
      where: {
        eventId: event.id,
        name: { equals: matName, mode: 'insensitive' },
      },
    });
    if (!mat) throw new HttpException('Mat not found', HttpStatus.NOT_FOUND);

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

    const currentRow =
      scheduleRows.find((row) => row.liveStatus === 'RUNNING') ??
      scheduleRows.find((row) => row.liveStatus === 'UPCOMING') ??
      null;

    const onDeckRow =
      currentRow == null
        ? null
        : scheduleRows.find(
            (row) =>
              row.id !== currentRow.id &&
              row.liveStatus === 'UPCOMING' &&
              (row.scheduleOrder ?? Number.MAX_SAFE_INTEGER) >
                (currentRow.scheduleOrder ?? Number.MAX_SAFE_INTEGER),
          ) ?? null;

    const nextRows = scheduleRows.filter((row) => {
      if (currentRow && row.id === currentRow.id) return false;
      if (onDeckRow && row.id === onDeckRow.id) return false;
      if (row.liveStatus === 'FINISHED') return false;
      if (!currentRow) return true;
      return (
        (row.scheduleOrder ?? Number.MAX_SAFE_INTEGER) >
        (currentRow.scheduleOrder ?? Number.MAX_SAFE_INTEGER)
      );
    });

    return {
      mat: { id: mat.id, name: mat.name },
      now: currentRow ? fightById.get(currentRow.id) ?? null : null,
      onDeck: onDeckRow ? fightById.get(onDeckRow.id) ?? null : null,
      next: nextRows
        .map((row) => fightById.get(row.id))
        .filter((fight): fight is (typeof fights)[number] => Boolean(fight))
        .slice(0, 3),
      fights: orderedFights,
    };
  }
}
