import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getUserAccountStatus } from '../users/users.state';
import type {
  ClubDetailsAthleteRow,
  ClubDetailsCoachRow,
  ClubDetailsRelatedAccountRow,
  ClubDetailsResponse,
} from './club-details.types';
import {
  ACTIVE_REGISTRATION_STATUSES,
  toLatestRegistration,
} from './club-details.mappers';

@Injectable()
export class ClubDetailsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(input: {
    organisationId: string;
    clubId: string;
  }): Promise<ClubDetailsResponse | null> {
    const club = await this.prisma.club.findFirst({
      where: {
        id: input.clubId,
        organisationId: input.organisationId,
      },
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!club) return null;

    const [users, athletes] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          organisationId: input.organisationId,
          clubId: club.id,
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          isActive: true,
          deletedAt: true,
          dqStartAt: true,
          dqEndAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      }),
      this.prisma.athlete.findMany({
        where: {
          organisationId: input.organisationId,
          clubId: club.id,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          sex: true,
          documentId: true,
          createdAt: true,
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
          { dateOfBirth: 'asc' },
        ],
      }),
    ]);

    const athleteIds = athletes.map((athlete) => athlete.id);
    const registrations =
      athleteIds.length > 0
        ? await this.prisma.registration.findMany({
            where: {
              organisationId: input.organisationId,
              athleteId: { in: athleteIds },
            },
            select: {
              athleteId: true,
              categoryCode: true,
              status: true,
              weighInStatus: true,
              createdAt: true,
              event: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  competitionStartDate: true,
                },
              },
              eventWeightCategory: {
                select: {
                  categoryTemplateWeight: {
                    select: { name: true },
                  },
                  eventAgeGroup: {
                    select: {
                      categoryTemplateAgeGroup: {
                        select: { name: true },
                      },
                    },
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
            },
            orderBy: [
              { event: { competitionStartDate: 'desc' } },
              { createdAt: 'desc' },
            ],
          })
        : [];

    const registrationsByAthlete = new Map<string, typeof registrations>();
    for (const registration of registrations) {
      const bucket = registrationsByAthlete.get(registration.athleteId) ?? [];
      bucket.push(registration);
      registrationsByAthlete.set(registration.athleteId, bucket);
    }

    const coaches: ClubDetailsCoachRow[] = [];
    const relatedAccounts: ClubDetailsRelatedAccountRow[] = [];

    for (const user of users) {
      const status = getUserAccountStatus(user);

      if (user.role === 'coach') {
        coaches.push({
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          status,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        });
        continue;
      }

      relatedAccounts.push({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        status,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      });
    }

    const athleteRows: ClubDetailsAthleteRow[] = athletes.map((athlete) => {
      const athleteRegistrations =
        registrationsByAthlete.get(athlete.id) ?? [];
      const latestRegistration = toLatestRegistration(athleteRegistrations[0]);
      const activeRegistrationCount = athleteRegistrations.filter((row) =>
        ACTIVE_REGISTRATION_STATUSES.has(row.status),
      ).length;
      const categoryCodes = Array.from(
        new Set(
          athleteRegistrations
            .map((row) => row.categoryCode.trim())
            .filter(Boolean),
        ),
      );

      return {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        dateOfBirth: athlete.dateOfBirth.toISOString(),
        sex: athlete.sex,
        documentId: athlete.documentId,
        createdAt: athlete.createdAt.toISOString(),
        registrationCount: athleteRegistrations.length,
        activeRegistrationCount,
        categoryCodes,
        latestRegistration,
      };
    });

    const representedCategoryCodes = Array.from(
      new Set(
        registrations
          .map((registration) => registration.categoryCode.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    const contactEmails = Array.from(
      new Set(
        coaches
          .map((coach) => coach.email.trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return {
      club: {
        id: club.id,
        name: club.name,
        city: club.city,
        country: club.country,
        createdAt: club.createdAt.toISOString(),
        updatedAt: club.updatedAt.toISOString(),
        contactEmails,
      },
      overview: {
        totalCoaches: coaches.length,
        activeCoachAccounts: coaches.filter(
          (coach) => coach.status === 'ACTIVE',
        ).length,
        totalAthletes: athleteRows.length,
        activeAthletes: athleteRows.filter(
          (athlete) => athlete.activeRegistrationCount > 0,
        ).length,
        activeRegistrations: registrations.filter((registration) =>
          ACTIVE_REGISTRATION_STATUSES.has(registration.status),
        ).length,
        representedCategories: representedCategoryCodes.length,
        representedCategoryCodes,
        maleAthletes: athleteRows.filter((athlete) => athlete.sex === 'MALE')
          .length,
        femaleAthletes: athleteRows.filter(
          (athlete) => athlete.sex === 'FEMALE',
        ).length,
        unspecifiedSexAthletes: athleteRows.filter((athlete) => !athlete.sex)
          .length,
        relatedAccounts: relatedAccounts.length,
      },
      coaches,
      athletes: athleteRows,
      relatedAccounts,
    };
  }
}
