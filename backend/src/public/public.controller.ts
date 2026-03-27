import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Event } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { ClubsService } from '../clubs/clubs.service';
import { EventCategoriesService } from '../events/event-categories.service';
import { getRegistrationStatus } from '../events/event-dates.helper';
import { PrismaService } from '../prisma/prisma.service';
import { AthleteProfileService } from '../athletes/athlete-profile.service';

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
    private readonly athleteProfiles: AthleteProfileService,
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

  @Get('athletes/:id')
  async getPublicAthlete(@Param('id') id: string) {
    const profile = await this.athleteProfiles.getPublicProfile(id);
    if (!profile) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return profile;
  }
}
