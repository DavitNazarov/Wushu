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

  /**
   * Top clubs by total wins across their athletes' completed fights.
   * Refreshes naturally as fights are confirmed; falls back to the most
   * recently created clubs so the section is never empty.
   */
  @Get('clubs/top')
  async listTopClubs() {
    const wonFights = await this.prisma.fight.findMany({
      where: {
        winnerAthleteId: { not: null },
        status: { in: ['COMPLETE', 'CONFIRMED'] },
      },
      select: { winnerAthlete: { select: { clubId: true } } },
    });
    const lostFights = await this.prisma.fight.findMany({
      where: {
        loserAthleteId: { not: null },
        status: { in: ['COMPLETE', 'CONFIRMED'] },
      },
      select: { loserAthlete: { select: { clubId: true } } },
    });

    const winsByClub = new Map<string, number>();
    for (const f of wonFights) {
      const cid = f.winnerAthlete?.clubId;
      if (cid) winsByClub.set(cid, (winsByClub.get(cid) ?? 0) + 1);
    }
    const lossesByClub = new Map<string, number>();
    for (const f of lostFights) {
      const cid = f.loserAthlete?.clubId;
      if (cid) lossesByClub.set(cid, (lossesByClub.get(cid) ?? 0) + 1);
    }

    const ranked = [...winsByClub.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (ranked.length > 0) {
      const clubs = await this.prisma.club.findMany({
        where: { id: { in: ranked.map(([id]) => id) } },
        select: {
          id: true,
          name: true,
          nameKa: true,
          city: true,
          country: true,
          _count: { select: { athletes: true } },
        },
      });
      const byId = new Map(clubs.map((c) => [c.id, c]));

      return ranked
        .map(([id, wins], idx) => {
          const c = byId.get(id);
          if (!c) return null;
          return {
            rank: idx + 1,
            id: c.id,
            name: c.name,
            nameKa: c.nameKa,
            city: c.city,
            country: c.country,
            athletes: c._count.athletes,
            wins,
            losses: lossesByClub.get(id) ?? 0,
          };
        })
        .filter((x) => x !== null);
    }

    const fallback = await this.prisma.club.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        nameKa: true,
        city: true,
        country: true,
        _count: { select: { athletes: true } },
      },
    });
    return fallback.map((c, idx) => ({
      rank: idx + 1,
      id: c.id,
      name: c.name,
      nameKa: c.nameKa,
      city: c.city,
      country: c.country,
      athletes: c._count.athletes,
      wins: 0,
      losses: 0,
    }));
  }

  /**
   * Live leaderboard. Counts wins/losses across all finished fights
   * (status COMPLETE or CONFIRMED) so the ranking refreshes in real time
   * as each competition progresses. Falls back to recent athletes when
   * no fights have completed yet, so the section is never empty.
   */
  @Get('athletes/top')
  async listTopAthletes() {
    const athleteSelect = {
      id: true,
      firstName: true,
      firstNameKa: true,
      lastName: true,
      lastNameKa: true,
      sex: true,
      club: {
        select: { id: true, name: true, nameKa: true, country: true },
      },
    } as const;

    const grouped = await this.prisma.fight.groupBy({
      by: ['winnerAthleteId'],
      where: {
        winnerAthleteId: { not: null },
        status: { in: ['COMPLETE', 'CONFIRMED'] },
      },
      _count: { winnerAthleteId: true },
      orderBy: { _count: { winnerAthleteId: 'desc' } },
      take: 5,
    });

    if (grouped.length > 0) {
      const ids = grouped
        .map((g) => g.winnerAthleteId)
        .filter((id): id is string => Boolean(id));

      const [athletes, lossCounts] = await Promise.all([
        this.prisma.athlete.findMany({
          where: { id: { in: ids } },
          select: athleteSelect,
        }),
        this.prisma.fight.groupBy({
          by: ['loserAthleteId'],
          where: {
            loserAthleteId: { in: ids },
            status: { in: ['COMPLETE', 'CONFIRMED'] },
          },
          _count: { loserAthleteId: true },
        }),
      ]);

      const lossesById = new Map<string, number>();
      for (const row of lossCounts) {
        if (row.loserAthleteId) {
          lossesById.set(row.loserAthleteId, row._count.loserAthleteId);
        }
      }

      const byId = new Map(athletes.map((a) => [a.id, a]));
      return grouped
        .map((g, idx) => {
          const a = g.winnerAthleteId ? byId.get(g.winnerAthleteId) : null;
          if (!a) return null;
          return {
            rank: idx + 1,
            id: a.id,
            firstName: a.firstName,
            firstNameKa: a.firstNameKa,
            lastName: a.lastName,
            lastNameKa: a.lastNameKa,
            sex: a.sex,
            club: a.club,
            wins: g._count.winnerAthleteId,
            losses: lossesById.get(a.id) ?? 0,
          };
        })
        .filter((x) => x !== null);
    }

    // Fallback: no finished fights yet — surface the most recent athletes
    // so the leaderboard renders something meaningful from the start.
    const fallback = await this.prisma.athlete.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: athleteSelect,
    });

    return fallback.map((a, idx) => ({
      rank: idx + 1,
      id: a.id,
      firstName: a.firstName,
      firstNameKa: a.firstNameKa,
      lastName: a.lastName,
      lastNameKa: a.lastNameKa,
      sex: a.sex,
      club: a.club,
      wins: 0,
      losses: 0,
    }));
  }

  @Get('clubs/:id')
  async getPublicClub(@Param('id') id: string) {
    const details = await this.clubs.getPublicDetails(id);
    if (!details) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return details;
  }

  @Get('athletes/:id')
  async getPublicAthlete(@Param('id') id: string) {
    const profile = await this.athleteProfiles.getPublicProfile(id);
    if (!profile) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return profile;
  }
}
