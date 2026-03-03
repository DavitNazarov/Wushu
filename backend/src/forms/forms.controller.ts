import { Controller, Post, Body, Req, HttpException, HttpStatus } from '@nestjs/common';
import Express from 'express';
import { PrismaService } from '../prisma/prisma.service';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitStore = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const existing = rateLimitStore.get(key) ?? [];
  const recent = existing.filter((ts) => ts >= windowStart);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(key, recent);
    return true;
  }
  recent.push(now);
  rateLimitStore.set(key, recent);
  return false;
}

@Controller('forms')
export class FormsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('contact')
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
    @Req() req: Express.Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string) ??
      req.ip ??
      'unknown';

    if (isRateLimited(ip)) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (body.website?.trim?.()) {
      return { ok: true };
    }

    if (!body.name || !body.email || !body.message) {
      throw new HttpException('INVALID_INPUT', HttpStatus.BAD_REQUEST);
    }

    const org = await this.prisma.organisation.findFirst();
    if (!org) {
      throw new HttpException('NO_ORGANISATION', HttpStatus.INTERNAL_SERVER_ERROR);
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
}
