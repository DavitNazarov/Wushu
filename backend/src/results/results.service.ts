import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEvent(organisationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organisationId },
      select: { id: true },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    return this.prisma.fight.findMany({
      where: { organisationId, eventId, status: 'CONFIRMED' },
      include: {
        redAthlete: { select: { id: true, firstName: true, lastName: true } },
        blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        winnerAthlete: {
          select: { id: true, firstName: true, lastName: true },
        },
        mat: { select: { id: true, name: true } },
      },
      orderBy: [{ categoryCode: 'asc' }, { round: 'asc' }, { boutNo: 'asc' }],
    });
  }
}
