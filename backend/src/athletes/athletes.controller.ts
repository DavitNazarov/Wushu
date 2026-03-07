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

const athleteBodySchema = z.object({
  id: z.string().cuid().optional(),
  clubId: z.string().cuid().optional().nullable(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
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
  documentId: z.string().trim().min(1).optional().nullable(),
  sex: z.enum(['MALE', 'FEMALE']).optional().nullable(),
});

type AthleteBodyInput = z.infer<typeof athleteBodySchema>;

@Controller('athletes')
@UseGuards(AuthGuard, CapabilityGuard)
export class AthletesController {
  constructor(private readonly athletes: AthletesService) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('clubId') clubId?: string,
    @Query('dateOfBirth') dateOfBirth?: string,
    @Query('documentId') documentId?: string,
  ) {
    const auth = req.auth!;
    // Coach: ignore client clubId, use auth.clubId only
    const effectiveClubId =
      auth.role === 'coach' ? (auth.clubId ?? undefined) : clubId || undefined;

    const parsedDob = dateOfBirth ? new Date(dateOfBirth) : undefined;

    const result = await this.athletes.list(auth.organisationId, {
      search,
      clubId: effectiveClubId,
      dateOfBirth: parsedDob,
      documentId: documentId || undefined,
    });

    return result;
  }

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

    // Coach: ignore client clubId, use auth.clubId only
    const effectiveClubId =
      auth.role === 'coach' ? auth.clubId! : (parsed.clubId ?? null);

    try {
      const { athlete, possibleDuplicates } =
        await this.athletes.createOrUpdate({
          organisationId: auth.organisationId,
          actorUserId: auth.sub,
          id: parsed.id,
          clubId: effectiveClubId,
          actorClubId: auth.role === 'coach' ? (auth.clubId ?? null) : null,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          dateOfBirth: dob,
          documentId: parsed.documentId ?? null,
          sex: parsed.sex ?? null,
        });

      return { athlete, possibleDuplicates };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'ATHLETE_NOT_IN_COACH_CLUB') {
        throw new HttpException(msg, HttpStatus.FORBIDDEN);
      }
      throw e;
    }
  }

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
