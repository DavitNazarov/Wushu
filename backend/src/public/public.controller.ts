import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  @Get('events')
  async listPublishedEvents() {
    return this.events.listPublished();
  }

  @Get('events/:id')
  async getPublishedEvent(@Param('id') id: string) {
    const event = await this.events.getPublishedById(id);
    if (!event) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return event;
  }

  @Get('news')
  async listPublishedNews() {
    const org = await this.prisma.organisation.findFirst();
    if (!org) return [];

    return this.prisma.newsPost.findMany({
      where: {
        organisationId: org.id,
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }
}
