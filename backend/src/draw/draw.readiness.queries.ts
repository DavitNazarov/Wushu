import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Audit log actions surfaced in the readiness overview's "Recent activity" tab.
// Used for both the recent-audit list (full history) and the "last draw run"
// summary (just EXECUTED/REGENERATED).
const DRAW_AUDIT_ACTIONS = [
  'DRAW_EXECUTED',
  'DRAW_REGENERATED',
  'DRAW_RESET',
  'BRACKETS_PUBLISHED',
] as const;

// All the data computeDrawReadiness needs in one bundle. Hand-typed so the
// compute step doesn't need to know about Prisma — easier to unit-test with
// hand-rolled fixtures.
export type DrawReadinessContext = {
  event: {
    id: string;
    name: string;
    lifecycle:
      | 'REG_OPEN'
      | 'LOCKED'
      | 'WEIGHIN'
      | 'WEIGH_IN_COMPLETED'
      | 'DRAWN'
      | 'PUBLISHED'
      | 'LIVE'
      | 'COMPLETED';
    registrationOpensAt: Date | null;
    registrationClosesAt: Date | null;
    published: boolean;
    publishTimingPolicyCode:
      | 'IMMEDIATE_AFTER_DRAW'
      | 'MANUAL_PUBLISH_LATER'
      | 'COMPETITION_DAY_ONLY';
  };
  categories: Array<{
    id: string;
    categoryTemplateWeight: {
      name: string;
      sortOrder: number;
    };
    eventAgeGroup: {
      categoryTemplateAgeGroup: {
        code: string;
        name: string;
        sex: 'MALE' | 'FEMALE' | null;
      };
    };
  }>;
  bracketCount: number;
  drawnCategoryIds: Set<string>;
  registrations: Array<{
    id: string;
    athleteId: string;
    status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    weighInStatus:
      | 'NOT_WEIGHED'
      | 'PASSED'
      | 'MOVED_UP'
      | 'FAILED'
      | 'OVERRIDE_APPROVED'
      | 'REWEIGH_ALLOWED'
      | 'DISQUALIFIED';
    eventWeightCategoryId: string | null;
    registeredEventWeightCategoryId: string | null;
    athlete: {
      id: string;
      firstName: string;
      lastName: string;
      documentId: string | null;
    };
    club: {
      name: string;
    } | null;
    eventWeightCategory: {
      categoryTemplateWeight: {
        name: string;
      };
    } | null;
    registeredEventWeightCategory: {
      categoryTemplateWeight: {
        name: string;
      };
    } | null;
    weighIns: Array<{
      id: string;
      override: boolean;
    }>;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    createdAt: Date;
    actorUserId: string | null;
    reason: string | null;
    override: boolean;
    actor: {
      displayName: string;
    } | null;
  }>;
  lastGeneration: {
    action: string;
    createdAt: Date;
    actorUserId: string | null;
    actor: {
      displayName: string;
    } | null;
  } | null;
};

// Loads every piece of data the readiness computer needs in a single
// Promise.all so the DB roundtrips happen in parallel. Pure I/O — no
// computation. Split out from DrawReadinessService so each layer has one
// responsibility.
@Injectable()
export class DrawReadinessQueryService {
  constructor(private readonly prisma: PrismaService) {}

  // Pull event + categories + brackets + drawn categories + registrations
  // (with athlete/club joins) + recent audit + last generation run.
  // Throws EVENT_NOT_FOUND when the event doesn't exist in this org.
  // drawnCategoryIds is computed from distinct fight.eventWeightCategoryId
  // values — cheaper than joining categories to brackets.
  async loadContext(input: {
    organisationId: string;
    eventId: string;
  }): Promise<DrawReadinessContext> {
    const event = await this.prisma.event.findFirst({
      where: { id: input.eventId, organisationId: input.organisationId },
      select: {
        id: true,
        name: true,
        lifecycle: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        published: true,
        publishTimingPolicyCode: true,
      },
    });
    if (!event) throw new Error('EVENT_NOT_FOUND');

    const [
      categories,
      bracketCount,
      drawnCategoryRows,
      registrations,
      recentAudit,
      lastGeneration,
    ] = await Promise.all([
      this.prisma.eventWeightCategory.findMany({
        where: { eventAgeGroup: { eventId: input.eventId } },
        select: {
          id: true,
          categoryTemplateWeight: {
            select: { name: true, sortOrder: true },
          },
          eventAgeGroup: {
            select: {
              categoryTemplateAgeGroup: {
                select: {
                  code: true,
                  name: true,
                  sex: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
        orderBy: [
          { eventAgeGroup: { categoryTemplateAgeGroup: { sortOrder: 'asc' } } },
          { categoryTemplateWeight: { sortOrder: 'asc' } },
        ],
      }),
      this.prisma.bracket.count({
        where: { organisationId: input.organisationId, eventId: input.eventId },
      }),
      this.prisma.fight.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
          eventWeightCategoryId: { not: null },
        },
        select: { eventWeightCategoryId: true },
        distinct: ['eventWeightCategoryId'],
      }),
      this.prisma.registration.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
        },
        select: {
          id: true,
          athleteId: true,
          status: true,
          weighInStatus: true,
          eventWeightCategoryId: true,
          registeredEventWeightCategoryId: true,
          athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              documentId: true,
            },
          },
          club: {
            select: {
              name: true,
            },
          },
          eventWeightCategory: {
            select: {
              categoryTemplateWeight: {
                select: { name: true },
              },
            },
          },
          registeredEventWeightCategory: {
            select: {
              categoryTemplateWeight: {
                select: { name: true },
              },
            },
          },
          weighIns: {
            select: {
              id: true,
              override: true,
            },
            orderBy: { attemptNo: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
          action: { in: [...DRAW_AUDIT_ACTIONS] },
        },
        select: {
          id: true,
          action: true,
          createdAt: true,
          actorUserId: true,
          reason: true,
          override: true,
          actor: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.auditLog.findFirst({
        where: {
          organisationId: input.organisationId,
          eventId: input.eventId,
          action: { in: ['DRAW_EXECUTED', 'DRAW_REGENERATED'] },
        },
        select: {
          action: true,
          createdAt: true,
          actorUserId: true,
          actor: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const drawnCategoryIds = new Set(
      drawnCategoryRows
        .map((row) => row.eventWeightCategoryId)
        .filter((value): value is string => Boolean(value)),
    );

    return {
      event,
      categories,
      bracketCount,
      drawnCategoryIds,
      registrations,
      recentAudit,
      lastGeneration,
    };
  }
}
