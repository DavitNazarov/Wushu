import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AthletesService } from './athletes.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { z } from 'zod';
import { AthleteProfileService } from './athlete-profile.service';

// Schema for both POST /athletes (create) and PUT-like upsert (presence of id).
// dateOfBirth is YYYY-MM-DD only — we reject ISO datetimes here because the
// admin/coach UI is day-only and accepting more would muddy timezone behaviour.
// documentId is required + non-empty (see CLAUDE.md "Document IDs"); the format
// (11-digit national vs free-text passport) is enforced on the frontend based
// on coach nationality, not here.
const athleteBodySchema = z.object({
  id: z.string().cuid().optional(),
  clubId: z.string().cuid().optional().nullable(),
  clubIds: z.array(z.string().cuid()).max(20).optional(),
  // Used only for club-less athletes; ignored when a club is set (city is
  // then derived from the club). Not .cuid() — migrated cities use UUIDs.
  cityId: z.string().min(1).max(64).optional().nullable(),
  firstName: z.string().trim().min(1),
  firstNameKa: z.string().trim().min(1).optional().nullable(),
  lastName: z.string().trim().min(1),
  lastNameKa: z.string().trim().min(1).optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
    .refine(
      (value) => {
        const d = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(d.getTime());
      },
      { message: 'Invalid dateOfBirth' },
    ),
  documentId: z.string().trim().min(1),
  sex: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  // Many-to-many: replaces the athlete's coach set when present.
  coachIds: z.array(z.string().min(1).max(64)).max(10).optional(),
});

type AthleteBodyInput = z.infer<typeof athleteBodySchema>;

// Shared admin/coach routes mounted at `/api/athletes`. Both roles use the
// same endpoints — the per-method logic narrows the dataset to the coach's
// own club when role==='coach'. ATHLETES_MANAGE is granted to both roles
// (see capabilities.ts) so the CapabilityGuard lets either through.
@Controller('athletes')
@UseGuards(AuthGuard, CapabilityGuard)
export class AthletesController {
  constructor(
    private readonly athletes: AthletesService,
    private readonly athleteProfiles: AthleteProfileService,
  ) {}

  // GET /api/athletes — list athletes with optional filters
  // (search by name, clubId, dateOfBirth, documentId).
  // For coaches: clubId is FORCED to their own club regardless of query string
  // (defensive — even if a coach crafts ?clubId=other, they only see their own).
  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('clubId') clubId?: string,
    @Query('dateOfBirth') dateOfBirth?: string,
    @Query('documentId') documentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const auth = req.auth!;
    // A coach with no club must NOT fall through to an unfiltered (all-org)
    // query — reject like the POST paths do (BF-1 data-leak fix).
    if (auth.role === 'coach' && !auth.clubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to manage athletes',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    // Coach: ignore client clubId, use auth.clubId only
    const effectiveClubId =
      auth.role === 'coach' ? auth.clubId! : clubId || undefined;

    const parsedDob = dateOfBirth ? new Date(dateOfBirth) : undefined;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? Number.parseInt(offset, 10) : undefined;

    const result = await this.athletes.list(auth.organisationId, {
      search,
      clubId: effectiveClubId,
      dateOfBirth: parsedDob,
      documentId: documentId || undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    });

    return result;
  }

  // POST /api/athletes — create-or-update upsert. If body.id is set, updates
  // that athlete; otherwise creates a new one. The endpoint also returns
  // `possibleDuplicates` so the UI can surface a "looks like an existing
  // athlete?" confirmation step on create.
  //
  // Coach-specific guards:
  //   - Must have a clubId on their account (COACH_NO_CLUB otherwise).
  //   - effectiveClubId is forced to their own club id.
  //   - Editing an athlete outside their club → ATHLETE_NOT_IN_COACH_CLUB (403).
  //
  // DOCUMENT_ID_ALREADY_EXISTS → 409 with structured body.
  @Post()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async createOrUpdate(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: AthleteBodyInput,
  ) {
    const auth = req.auth!;

    if (auth.role === 'coach' && !auth.clubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to manage athletes',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const parsed = athleteBodySchema.parse(body);
    const dob = new Date(`${parsed.dateOfBirth}T00:00:00.000Z`);

    // Coaches may edit athletes in their membership club, but they don't get
    // to rewrite the athlete's primary/membership clubs on update.
    const effectiveClubId =
      auth.role === 'coach'
        ? parsed.id
          ? undefined
          : auth.clubId!
        : (parsed.clubId ?? null);
    const effectiveClubIds =
      auth.role === 'coach'
        ? parsed.id
          ? undefined
          : [auth.clubId!]
        : parsed.clubIds;

    try {
      const { athlete, possibleDuplicates } =
        await this.athletes.createOrUpdate({
          organisationId: auth.organisationId,
          actorUserId: auth.sub,
          id: parsed.id,
          clubId: effectiveClubId,
          clubIds: effectiveClubIds,
          cityId: parsed.cityId ?? null,
          actorClubId: auth.role === 'coach' ? (auth.clubId ?? null) : null,
          firstName: parsed.firstName,
          firstNameKa: parsed.firstNameKa ?? null,
          lastName: parsed.lastName,
          lastNameKa: parsed.lastNameKa ?? null,
          dateOfBirth: dob,
          documentId: parsed.documentId,
          sex: parsed.sex ?? null,
          coachIds: parsed.coachIds,
        });

      return { athlete, possibleDuplicates };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'ATHLETE_NOT_IN_COACH_CLUB') {
        throw new HttpException(msg, HttpStatus.FORBIDDEN);
      }
      if (msg === 'DOCUMENT_ID_ALREADY_EXISTS') {
        throw new HttpException(
          {
            code: 'DOCUMENT_ID_ALREADY_EXISTS',
            message: 'An athlete with this document ID already exists',
          },
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }
  }

  // GET /api/athletes/:id — single-athlete detail (private/managed view).
  // Routes through AthleteProfileService.getPrivateProfile which assembles
  // the same shape used by the admin and coach detail screens (registration
  // history, weigh-in attempts, etc.). Coaches only see athletes in their
  // own club (actorClubId is passed through for the service-side filter).
  @Get(':id')
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    // Coach without a club has no scope to resolve against — reject rather
    // than letting actorClubId=null skip the club-match check (BF-1).
    if (auth.role === 'coach' && !auth.clubId) {
      throw new HttpException(
        {
          code: 'COACH_NO_CLUB',
          message: 'Coach must be assigned to a club to manage athletes',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const profile = await this.athleteProfiles.getPrivateProfile({
      organisationId: auth.organisationId,
      athleteId: id,
      actorClubId: auth.role === 'coach' ? (auth.clubId ?? null) : null,
    });

    if (!profile) {
      throw new HttpException('ATHLETE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    return profile;
  }

  // POST /api/athletes/merge — collapse two athlete records into one.
  // Used to clean up duplicates created from typos/passport-vs-national-ID
  // mixups. Requires `reason` (audit trail). The service moves every
  // registration/weighin/result from secondary→primary and deletes the
  // secondary inside a transaction. Errors:
  //   ATHLETE_NOT_FOUND | ATHLETE_NOT_IN_COACH_CLUB → 404
  //   MERGE_IDS_MUST_DIFFER                          → 400
  @Post('merge')
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async merge(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      primaryId: string;
      secondaryId: string;
      reason: string;
    },
  ) {
    const auth = req.auth!;

    if (!body.primaryId || !body.secondaryId || !body.reason?.trim()) {
      throw new HttpException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST);
    }

    try {
      const merged = await this.athletes.merge({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        actorClubId: auth.role === 'coach' ? (auth.clubId ?? null) : null,
        primaryId: body.primaryId,
        secondaryId: body.secondaryId,
        reason: body.reason.trim(),
      });

      return merged;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'ATHLETE_NOT_FOUND' || msg === 'ATHLETE_NOT_IN_COACH_CLUB') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (msg === 'MERGE_IDS_MUST_DIFFER') {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
