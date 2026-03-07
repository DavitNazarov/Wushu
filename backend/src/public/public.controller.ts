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

function withRegistrationStatus(event: Event) {
  return { ...event, registrationStatus: getRegistrationStatus(event) };
}

@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly clubs: ClubsService,
    private readonly eventCategories: EventCategoriesService,
  ) {}

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

  @Get('brackets')
  async getPublicBrackets(@Query('eventSlug') eventSlug: string) {
    if (!eventSlug)
      throw new HttpException('eventSlug_REQUIRED', HttpStatus.BAD_REQUEST);

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

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

    return this.prisma.fight.findMany({
      where: { eventId: event.id },
      include: {
        mat: true,
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ matId: 'asc' }, { orderInMat: 'asc' }],
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

    const event = await this.events.getPublicOrRegistrableBySlug(eventSlug);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    const mat = await this.prisma.mat.findFirst({
      where: { eventId: event.id, name: matName },
    });
    if (!mat) throw new HttpException('Mat not found', HttpStatus.NOT_FOUND);

    const fights = await this.prisma.fight.findMany({
      where: { matId: mat.id },
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

    const now = fights.find(
      (f) => f.status === 'IN_PROGRESS' || f.status === 'PAUSED',
    );
    const onDeck = fights.find((f) => f.status === 'ON_DECK');
    const next = fights
      .filter(
        (f) =>
          f.status === 'QUEUED' &&
          (!now || f.orderInMat! > (now.orderInMat ?? 0)),
      )
      .slice(0, 3);

    return {
      mat: { id: mat.id, name: mat.name },
      now: now ?? null,
      onDeck: onDeck ?? null,
      next,
      fights,
    };
  }
}
