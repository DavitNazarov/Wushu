import {
  Controller,
  Get,
  Header,
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
import { resolvePublicOrg } from '../common/public-org';
import { AthleteProfileService } from '../athletes/athlete-profile.service';
import { SkipThrottle } from '@nestjs/throttler';
import { CACHE_LONG } from './public-cache';

function withRegistrationStatus(event: Event) {
  return { ...event, registrationStatus: getRegistrationStatus(event) };
}

// Public, anonymous, read-only content (clubs/events/news/athletes). Exempt
// from the strict 'short' bucket (10 req/10s) — that bucket exists to slow
// auth-credential bursts, but it wrongly catches normal spectator traffic
// (e.g. a page refresh fans out to several public GETs, and many viewers share
// a NAT/CDN IP). The 'default' bucket (120/min) still applies as basic origin
// protection; in production these sit behind the CDN cache anyway.
@SkipThrottle({ short: true })
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
  @Header('Cache-Control', CACHE_LONG)
  async listPublishedEvents() {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return [];

    const events = await this.events.listPublicAndRegistrable(org.id);
    return events.map(withRegistrationStatus);
  }

  @Get('events/:slug')
  @Header('Cache-Control', CACHE_LONG)
  async getPublishedEvent(@Param('slug') slug: string) {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    const event = await this.events.getPublicOrRegistrableBySlug(slug, org.id);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return withRegistrationStatus(event);
  }

  /** Public: event categories — no auth required, used by coach registration UI */
  @Get('events/:slug/categories')
  @Header('Cache-Control', CACHE_LONG)
  async getPublishedEventCategories(@Param('slug') slug: string) {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    const event = await this.events.getPublicOrRegistrableBySlug(slug, org.id);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return this.eventCategories.getCategories(event.id, event.organisationId);
  }

  @Get('news')
  @Header('Cache-Control', CACHE_LONG)
  async listPublishedNews() {
    const org = await resolvePublicOrg(this.prisma);
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
  @Header('Cache-Control', CACHE_LONG)
  async getNewsPost(@Param('slug') slug: string) {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    const post = await this.prisma.newsPost.findFirst({
      where: { organisationId: org.id, slug, published: true },
      orderBy: { publishedAt: 'desc' },
      include: {
        event: { select: { id: true, name: true, slug: true, location: true } },
      },
    });
    if (!post) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return post;
  }

  @Get('clubs')
  @Header('Cache-Control', CACHE_LONG)
  async listPublicClubs() {
    return this.clubs.listPublic();
  }

  /**
   * Top clubs by total wins across their athletes' completed fights.
   * Refreshes naturally as fights are confirmed; falls back to the most
   * recently created clubs so the section is never empty.
   */
  @Get('clubs/top')
  @Header('Cache-Control', CACHE_LONG)
  async listTopClubs() {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return [];

    const wonFights = await this.prisma.fight.findMany({
      where: {
        organisationId: org.id,
        winnerAthleteId: { not: null },
        status: { in: ['COMPLETE', 'CONFIRMED'] },
      },
      select: { winnerAthlete: { select: { clubId: true } } },
    });
    const lostFights = await this.prisma.fight.findMany({
      where: {
        organisationId: org.id,
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
        where: { organisationId: org.id, id: { in: ranked.map(([id]) => id) } },
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
      where: { organisationId: org.id },
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
  @Header('Cache-Control', CACHE_LONG)
  async listTopAthletes() {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return [];

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
        organisationId: org.id,
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
          where: { organisationId: org.id, id: { in: ids } },
          select: athleteSelect,
        }),
        this.prisma.fight.groupBy({
          by: ['loserAthleteId'],
          where: {
            organisationId: org.id,
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
      where: { organisationId: org.id },
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
  @Header('Cache-Control', CACHE_LONG)
  async getPublicClub(@Param('id') id: string) {
    const details = await this.clubs.getPublicDetails(id);
    if (!details) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return details;
  }

  @Get('athletes/:id')
  @Header('Cache-Control', CACHE_LONG)
  async getPublicAthlete(@Param('id') id: string) {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    const profile = await this.athleteProfiles.getPublicProfile(id, org.id);
    if (!profile) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return profile;
  }
}
