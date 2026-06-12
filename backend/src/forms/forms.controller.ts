import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePublicOrg } from '../common/public-org';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';

const contactSchema = z.object({
  // Max caps keep a single spam submission bounded well below the global
  // 100 KB body limit (ContactSubmission rows are kept indefinitely).
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(320),
  message: z.string().trim().min(1).max(5_000),
  clubName: z.string().trim().min(1).max(200).nullable().optional(),
  type: z.enum(['contact', 'membership']),
  website: z.string().trim().max(500).nullable().optional(),
});

@Controller('forms')
export class FormsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('contact')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async contact(@Body() body: unknown) {
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid contact payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const data = parsed.data;

    if (data.website?.trim()) {
      return { ok: true };
    }

    const org = await resolvePublicOrg(this.prisma);
    if (!org) {
      throw new HttpException(
        'NO_ORGANISATION',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await this.prisma.contactSubmission.create({
      data: {
        organisationId: org.id,
        type: data.type,
        name: data.name,
        email: data.email,
        message: data.message,
        clubName: data.clubName ?? null,
      },
    });

    return { ok: true };
  }

  @Get('submissions')
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async listSubmissions(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.prisma.contactSubmission.findMany({
      where: { organisationId: auth.organisationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('submissions/:id/handled')
  @UseGuards(AuthGuard, CapabilityGuard)
  @RequireCapability(CAPABILITIES.EVENTS_MANAGE)
  async markHandled(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    const submission = await this.prisma.contactSubmission.findFirst({
      where: { id, organisationId: auth.organisationId },
    });
    if (!submission) throw new HttpException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return this.prisma.contactSubmission.update({
      where: { id },
      data: { status: 'HANDLED', handledAt: new Date() },
    });
  }
}
