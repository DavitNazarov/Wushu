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
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';

@Controller('forms')
export class FormsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('contact')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async contact(
    @Body()
    body: {
      name: string;
      email: string;
      message: string;
      clubName?: string | null;
      type: 'contact' | 'membership';
      website?: string | null;
    },
  ) {
    if (body.website?.trim?.()) {
      return { ok: true };
    }

    if (!body.name || !body.email || !body.message) {
      throw new HttpException('INVALID_INPUT', HttpStatus.BAD_REQUEST);
    }

    const org = await this.prisma.organisation.findFirst();
    if (!org) {
      throw new HttpException(
        'NO_ORGANISATION',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await this.prisma.contactSubmission.create({
      data: {
        organisationId: org.id,
        type: body.type,
        name: body.name,
        email: body.email,
        message: body.message,
        clubName: body.clubName ?? null,
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
