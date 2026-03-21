import { Injectable } from '@nestjs/common';
import { UserRole, type AthleteSex } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractScoreToken } from '../draw/brackets.helpers';
import type { AthleteProfileFightRow, AthleteProfileRegistrationRow, AthleteProfileResponse } from './athlete-profile.types';

@Injectable()
export class AthleteProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrivateProfile(input: {
    organisationId: string;
    athleteId: string;
    actorClubId?: string | null;
  }): Promise<AthleteProfileResponse | null> {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: input.athleteId, organisationId: input.organisationId },
      include: {
        club: {
          include: {
            coaches: {
              where: { role: UserRole.coach, isActive: true, deletedAt: null },
              orderBy: { displayName: 'asc' },
              select: { id: true, displayName: true },
            },
          },
        },
      },
    });

    if (!athlete) return null;
    if (input.actorClubId && athlete.clubId !== input.actorClubId) return null;

    return this.buildProfile({
      organisationId: athlete.organisationId,
      athleteId: athlete.id,
      visibility: 'private',
      identity: {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        sex: athlete.sex,
        dateOfBirth: athlete.dateOfBirth.toISOString(),
        club: athlete.club
          ? {
              id: athlete.club.id,
              name: athlete.club.name,
              city: athlete.club.city,
              country: athlete.club.country,
            }
          : null,
        coaches: athlete.club?.coaches ?? [],
      },
    });
  }

  async getPublicProfile(athleteId: string): Promise<AthleteProfileResponse | null> {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        club: {
          select: { id: true, name: true, city: true, country: true },
        },
      },
    });
    if (!athlete) return null;

    const profile = await this.buildProfile({
      organisationId: athlete.organisationId,
      athleteId: athlete.id,
      visibility: 'public',
      identity: {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        sex: athlete.sex,
        club: athlete.club,
      },
    });

    if (profile.registrations.length === 0 && profile.fights.length === 0) {
      return null;
    }

    return profile;
  }

  private async buildProfile(input: {
    organisationId: string;
    athleteId: string;
    visibility: 'private' | 'public';
    identity: AthleteProfileResponse['athlete'];
  }): Promise<AthleteProfileResponse> {
    const [registrations, fights] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          organisationId: input.organisationId,
          athleteId: input.athleteId,
        },
        include: {
          event: true,
          eventWeightCategory: {
            include: {
              categoryTemplateWeight: { select: { name: true } },
              eventAgeGroup: {
                include: {
                  categoryTemplateAgeGroup: {
                    select: { name: true, sex: true },
                  },
                },
              },
            },
          },
          registeredEventWeightCategory: {
            include: {
              categoryTemplateWeight: { select: { name: true } },
            },
          },
          weighIns: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              decision: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ event: { competitionStartDate: 'desc' } }, { createdAt: 'desc' }],
      }),
      this.prisma.fight.findMany({
        where: {
          organisationId: input.organisationId,
          OR: [{ redAthleteId: input.athleteId }, { blueAthleteId: input.athleteId }],
        },
        include: {
          event: true,
          mat: { select: { name: true } },
          redAthlete: { select: { id: true, firstName: true, lastName: true } },
          blueAthlete: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ scheduledStartTime: 'asc' }, { round: 'asc' }, { boutNo: 'asc' }],
      }),
    ]);

    const visibleRegistrations = registrations.filter((registration) =>
      input.visibility === 'private' ? true : registration.event.published,
    );
    const visibleFights = fights.filter((fight) =>
      input.visibility === 'private' ? true : fight.event.published,
    );

    return {
      athlete: input.identity,
      registrations: visibleRegistrations.map((registration): AthleteProfileRegistrationRow => {
        const initialName =
          registration.registeredEventWeightCategory?.categoryTemplateWeight.name ?? null;
        const finalName =
          registration.eventWeightCategory?.categoryTemplateWeight.name ?? null;
        const latestWeighIn = registration.weighIns[0] ?? null;

        return {
          id: registration.id,
          eventId: registration.eventId,
          eventName: registration.event.name,
          eventSlug: registration.event.slug,
          eventLifecycle: registration.event.lifecycle,
          eventPublished: registration.event.published,
          competitionStartDate: registration.event.competitionStartDate.toISOString(),
          competitionEndDate: registration.event.competitionEndDate.toISOString(),
          categoryCode: registration.categoryCode,
          ageGroupName:
            registration.eventWeightCategory?.eventAgeGroup.categoryTemplateAgeGroup
              .name ?? null,
          division:
            (registration.eventWeightCategory?.eventAgeGroup.categoryTemplateAgeGroup
              .sex as AthleteSex | null) ?? null,
          ...(input.visibility === 'private'
            ? {
                registrationStatus: registration.status,
                weighInStatus: registration.weighInStatus,
                latestWeighInDecision: latestWeighIn?.decision ?? null,
                latestWeighInAt: latestWeighIn?.createdAt.toISOString() ?? null,
              }
            : {}),
          initialWeightCategoryName: initialName,
          finalWeightCategoryName: finalName,
          movedUp: Boolean(initialName && finalName && initialName !== finalName),
        };
      }),
      fights: visibleFights.map((fight): AthleteProfileFightRow => {
        const athleteCorner = fight.redAthleteId === input.athleteId ? 'RED' : 'BLUE';
        const opponent =
          athleteCorner === 'RED' ? fight.blueAthlete ?? null : fight.redAthlete ?? null;

        return {
          id: fight.id,
          eventId: fight.eventId,
          eventName: fight.event.name,
          eventSlug: fight.event.slug,
          eventLifecycle: fight.event.lifecycle,
          categoryCode: fight.categoryCode,
          round: fight.round,
          boutNo: fight.boutNo,
          status: fight.status,
          winMethod: fight.winMethod ?? null,
          score: extractScoreToken(fight.notes),
          scheduledStartTime: fight.scheduledStartTime?.toISOString() ?? null,
          matName: fight.mat?.name ?? null,
          athleteCorner,
          opponentAthleteId: opponent?.id ?? null,
          opponentName: opponent ? `${opponent.firstName} ${opponent.lastName}` : null,
          winnerAthleteId: fight.winnerAthleteId ?? null,
        };
      }),
    };
  }
}
