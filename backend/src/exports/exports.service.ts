import { mkdir, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

export type ExportType = 'registrations' | 'brackets' | 'schedule' | 'results';

const EXPORT_DIR = '/tmp/wushu-exports';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async generate(input: {
    organisationId: string;
    eventId: string;
    actorUserId: string;
    types: ExportType[];
  }) {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
      select: { id: true, name: true, slug: true },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    await mkdir(EXPORT_DIR, { recursive: true });

    const links: Array<{ type: ExportType; url: string; id: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const type of input.types) {
        const payload = await this.getPayload(
          input.organisationId,
          input.eventId,
          type,
        );
        const id = randomUUID();
        const filePath = this.filePathForId(id);
        await writeFile(
          filePath,
          JSON.stringify(
            {
              type,
              generatedAt: new Date().toISOString(),
              eventId: input.eventId,
              payload,
            },
            null,
            2,
          ),
          'utf8',
        );

        const slug = `${event.slug}-${type}-${id.slice(0, 8)}`;
        const url = `/api/exports/${id}/download`;

        await tx.documentLink.create({
          data: {
            organisationId: input.organisationId,
            title: `${event.name} ${type} export`,
            slug,
            url,
          },
        });

        links.push({ type, url, id });
      }

      await this.audit.write(
        {
          organisationId: input.organisationId,
          eventId: input.eventId,
          actorUserId: input.actorUserId,
          action: 'EXPORTS_GENERATED',
          entityType: 'event',
          entityId: input.eventId,
          after: { types: input.types, links } as unknown as Prisma.JsonValue,
        },
        tx,
      );
    });

    return links;
  }

  /**
   * Verify that a DocumentLink with the given export URL belongs to the
   * specified organisation. Returns true when ownership is confirmed.
   */
  async verifyExportOwnership(
    id: string,
    organisationId: string,
  ): Promise<boolean> {
    const url = `/api/exports/${id}/download`;
    const link = await this.prisma.documentLink.findFirst({
      where: { url, organisationId },
      select: { id: true },
    });
    return link !== null;
  }

  async readExportFile(id: string): Promise<string> {
    // Validate that id is a canonical UUID — prevents path-traversal via
    // crafted values like "../../etc/passwd" before joining the path.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      throw new BadRequestException('INVALID_EXPORT_ID');
    }

    const filePath = this.filePathForId(id);

    // Double-check the resolved path stays inside EXPORT_DIR even after any
    // OS-level path normalisation (defence in depth).
    const resolved = resolve(filePath);
    const exportDirResolved = resolve(EXPORT_DIR);
    if (!resolved.startsWith(exportDirResolved + '/')) {
      throw new BadRequestException('INVALID_EXPORT_ID');
    }

    return readFile(filePath, 'utf8');
  }

  private filePathForId(id: string) {
    return join(EXPORT_DIR, `${id}.json`);
  }

  private async getPayload(
    organisationId: string,
    eventId: string,
    type: ExportType,
  ) {
    if (type === 'registrations') {
      return this.prisma.registration.findMany({
        where: { organisationId, eventId },
        include: {
          athlete: {
            select: {
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              documentId: true,
            },
          },
          club: { select: { name: true } },
        },
        orderBy: [{ categoryCode: 'asc' }, { createdAt: 'asc' }],
      });
    }

    if (type === 'brackets') {
      return this.prisma.bracket.findMany({
        where: { organisationId, eventId },
        include: {
          fights: {
            include: {
              redAthlete: { select: { firstName: true, lastName: true } },
              blueAthlete: { select: { firstName: true, lastName: true } },
              winnerAthlete: { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
          },
        },
        orderBy: { categoryCode: 'asc' },
      });
    }

    if (type === 'schedule') {
      return this.prisma.fight.findMany({
        where: { organisationId, eventId },
        include: {
          mat: { select: { name: true, order: true } },
          redAthlete: { select: { firstName: true, lastName: true } },
          blueAthlete: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ matId: 'asc' }, { orderInMat: 'asc' }],
      });
    }

    return this.prisma.fight.findMany({
      where: {
        organisationId,
        eventId,
        status: { in: ['COMPLETE', 'CONFIRMED'] },
      },
      include: {
        redAthlete: { select: { firstName: true, lastName: true } },
        blueAthlete: { select: { firstName: true, lastName: true } },
        winnerAthlete: { select: { firstName: true, lastName: true } },
        mat: { select: { name: true } },
      },
      orderBy: [{ categoryCode: 'asc' }, { round: 'asc' }, { boutNo: 'asc' }],
    });
  }
}
