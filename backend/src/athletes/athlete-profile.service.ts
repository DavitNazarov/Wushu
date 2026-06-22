import { Injectable } from '@nestjs/common';
import { UserRole, type AthleteSex } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractScoreToken } from '../draw/brackets.helpers';
import {
  computeCategoryResults,
  type CompetitionFight,
} from '../competition/competition.logic';
import type {
  AthleteMedalSummary,
  AthleteProfileFightRow,
  AthleteProfileRegistrationRow,
  AthleteProfileResponse,
} from './athlete-profile.types';

// Read-only assembler for the athlete profile pages — both the admin/coach
// "private" detail view (sees DQ status, weigh-in notes, draft events) and
// the unauthenticated "public" view (sees only published events, no personal
// status). Used by both /api/athletes/:id (admin) and /api/public/...
@Injectable()
export class AthleteProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // Private view used by admins and (scoped) coaches. Coaches see only their
  // own club's athletes — the actorClubId check returns null instead of
  // throwing so the controller turns it into a generic 404 (no enumeration).
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
            country: { select: { name: true } },
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
        firstNameKa: athlete.firstNameKa,
        lastName: athlete.lastName,
        lastNameKa: athlete.lastNameKa,
        fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        sex: athlete.sex,
        dateOfBirth: athlete.dateOfBirth.toISOString(),
        club: athlete.club
          ? {
              id: athlete.club.id,
              name: athlete.club.name,
              nameKa: athlete.club.nameKa,
              city: athlete.club.city,
              country: athlete.club.country?.name ?? null,
            }
          : null,
        coaches: athlete.club?.coaches ?? [],
      },
    });
  }

  // Public view used by the unauthenticated /athletes/:id pages. Differences
  // from getPrivateProfile:
  //   1. dateOfBirth is intentionally omitted from the identity payload
  //      (PII — public callers don't need it).
  //   2. registrations/fights tied to unpublished events are filtered out.
  // Every athlete that exists (in the public org) gets a profile — an athlete
  // with no published-event history simply renders with empty events/fights and
  // a zeroed medal tally. We 404 only when the id doesn't resolve to an athlete.
  async getPublicProfile(
    athleteId: string,
    organisationId?: string,
  ): Promise<AthleteProfileResponse | null> {
    const athlete = await this.prisma.athlete.findFirst({
      where: {
        id: athleteId,
        ...(organisationId ? { organisationId } : {}),
      },
      include: {
        club: {
          include: {
            coaches: {
              where: { role: UserRole.coach, isActive: true, deletedAt: null },
              orderBy: { displayName: 'asc' },
              select: { id: true, displayName: true },
            },
            country: { select: { name: true } },
          },
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
        firstNameKa: athlete.firstNameKa,
        lastName: athlete.lastName,
        lastNameKa: athlete.lastNameKa,
        fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        sex: athlete.sex,
        club: athlete.club
          ? {
              id: athlete.club.id,
              name: athlete.club.name,
              nameKa: athlete.club.nameKa,
              city: athlete.club.city,
              country: athlete.club.country?.name ?? null,
            }
          : null,
        coaches: athlete.club?.coaches ?? [],
      },
    });

    return profile;
  }

  // Shared implementation that gathers registrations + fights for the
  // athlete in parallel and shapes them into the response.
  // Visibility rules:
  //   - public: drops registrations/fights tied to unpublished events,
  //     and omits private-only fields (weighInStatus, registrationStatus,
  //     latest weigh-in decision).
  //   - private: shows everything.
  // Computed extras:
  //   - movedUp: true when initial vs final weight category differ — used
  //     by the UI to render a "moved up a class at weigh-in" badge.
  //   - score: extracted from fight.notes via extractScoreToken (the score
  //     is encoded inside notes for legacy reasons).
  //   - athleteCorner / opponent: derived from which side this athlete sat on.
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
        orderBy: [
          { event: { competitionStartDate: 'desc' } },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.fight.findMany({
        where: {
          organisationId: input.organisationId,
          OR: [
            { redAthleteId: input.athleteId },
            { blueAthleteId: input.athleteId },
          ],
        },
        include: {
          event: true,
          mat: { select: { name: true } },
          redAthlete: { select: { id: true, firstName: true, lastName: true } },
          blueAthlete: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [
          { scheduledStartTime: 'asc' },
          { round: 'asc' },
          { boutNo: 'asc' },
        ],
      }),
    ]);

    const visibleRegistrations = registrations.filter((registration) =>
      input.visibility === 'private' ? true : registration.event.published,
    );
    const visibleFights = fights.filter((fight) =>
      input.visibility === 'private' ? true : fight.event.published,
    );

    const medals = await this.computeMedalSummary({
      organisationId: input.organisationId,
      athleteId: input.athleteId,
      // Group by bracket, not eventWeightCategoryId. A fight always carries a
      // bracketId (set at draw + seed time), whereas eventWeightCategoryId is
      // only populated once a registration has a final weigh-in category and is
      // NULL for seeded/legacy data — keying off it dropped every such fight,
      // zeroing the medal tally. bracketId mirrors the results-page bucketKey,
      // so profile medals stay in sync with the public results page.
      bracketIds: [
        ...new Set(
          visibleFights
            .map((fight) => fight.bracketId)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
    });

    return {
      athlete: input.identity,
      medals,
      registrations: visibleRegistrations.map(
        (registration): AthleteProfileRegistrationRow => {
          const initialName =
            registration.registeredEventWeightCategory?.categoryTemplateWeight
              .name ?? null;
          const finalName =
            registration.eventWeightCategory?.categoryTemplateWeight.name ??
            null;
          const latestWeighIn = registration.weighIns[0] ?? null;

          return {
            id: registration.id,
            eventId: registration.eventId,
            eventName: registration.event.name,
            eventSlug: registration.event.slug,
            eventLifecycle: registration.event.lifecycle,
            eventPublished: registration.event.published,
            competitionStartDate:
              registration.event.competitionStartDate.toISOString(),
            competitionEndDate:
              registration.event.competitionEndDate.toISOString(),
            categoryCode: registration.categoryCode,
            ageGroupName:
              registration.eventWeightCategory?.eventAgeGroup
                .categoryTemplateAgeGroup.name ?? null,
            division:
              (registration.eventWeightCategory?.eventAgeGroup
                .categoryTemplateAgeGroup.sex as AthleteSex | null) ?? null,
            ...(input.visibility === 'private'
              ? {
                  registrationStatus: registration.status,
                  weighInStatus: registration.weighInStatus,
                  latestWeighInDecision: latestWeighIn?.decision ?? null,
                  latestWeighInAt:
                    latestWeighIn?.createdAt.toISOString() ?? null,
                }
              : {}),
            initialWeightCategoryName: initialName,
            finalWeightCategoryName: finalName,
            movedUp: Boolean(
              initialName && finalName && initialName !== finalName,
            ),
          };
        },
      ),
      fights: visibleFights.map((fight): AthleteProfileFightRow => {
        const athleteCorner =
          fight.redAthleteId === input.athleteId ? 'RED' : 'BLUE';
        const opponent =
          athleteCorner === 'RED'
            ? (fight.blueAthlete ?? null)
            : (fight.redAthlete ?? null);

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
          opponentName: opponent
            ? `${opponent.firstName} ${opponent.lastName}`
            : null,
          winnerAthleteId: fight.winnerAthleteId ?? null,
        };
      }),
    };
  }

  // Career medal tally. For every bracket the athlete has competed in (already
  // visibility-filtered by the caller via `bracketIds`), we pull the *whole*
  // bracket — not just this athlete's bouts — and run the same placement logic
  // the results page uses (computeCategoryResults). We then read off where this
  // athlete landed:
  //   GOLD/SILVER/BRONZE -> podium counters
  //   no medal but the category is fully decided -> `other` (4th+/eliminated)
  //   category still in progress -> not counted yet
  // Keyed by bracketId (always present on a fight) rather than
  // eventWeightCategoryId (NULL for seeded/legacy data) so the tally matches
  // the public results page.
  private async computeMedalSummary(input: {
    organisationId: string;
    athleteId: string;
    bracketIds: string[];
  }): Promise<AthleteMedalSummary> {
    const empty: AthleteMedalSummary = {
      gold: 0,
      silver: 0,
      bronze: 0,
      other: 0,
      total: 0,
    };
    if (input.bracketIds.length === 0) return empty;

    const fights = await this.prisma.fight.findMany({
      where: {
        organisationId: input.organisationId,
        bracketId: { in: input.bracketIds },
      },
      select: {
        bracketId: true,
        id: true,
        round: true,
        boutNo: true,
        status: true,
        redAthleteId: true,
        blueAthleteId: true,
        winnerAthleteId: true,
        winMethod: true,
        notes: true,
        event: { select: { bronzePolicyCode: true } },
      },
    });

    const byBracket = new Map<
      string,
      { fights: CompetitionFight[]; bronzePolicy: 'TWO_BRONZES' }
    >();
    for (const fight of fights) {
      if (!fight.bracketId) continue;
      const bucket = byBracket.get(fight.bracketId) ?? {
        fights: [],
        bronzePolicy: fight.event.bronzePolicyCode,
      };
      bucket.fights.push({
        id: fight.id,
        round: fight.round,
        boutNo: fight.boutNo,
        status: fight.status,
        redAthleteId: fight.redAthleteId ?? null,
        blueAthleteId: fight.blueAthleteId ?? null,
        winnerAthleteId: fight.winnerAthleteId ?? null,
        winMethod: fight.winMethod ?? null,
        notes: fight.notes ?? null,
      });
      byBracket.set(fight.bracketId, bucket);
    }

    const summary = { ...empty };
    for (const { fights: bracketFights, bronzePolicy } of byBracket.values()) {
      const results = computeCategoryResults({
        fights: bracketFights,
        bronzePolicy,
      });
      const placement = results.placements.find(
        (row) => row.athleteId === input.athleteId,
      );
      if (placement?.medal === 'GOLD') summary.gold += 1;
      else if (placement?.medal === 'SILVER') summary.silver += 1;
      else if (placement?.medal === 'BRONZE') summary.bronze += 1;
      else if (results.isComplete) summary.other += 1;
    }
    summary.total = summary.gold + summary.silver + summary.bronze;
    return summary;
  }
}
