import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { Req } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../common/parse-body';

// SEC-8: bound the content fields. Without this, news title/slug/body have no
// length/format limit (content abuse / unbounded storage growth).
const upsertNewsSchema = z.object({
  id: z.string().cuid().optional(),
  eventId: z.string().cuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(
      /^[a-z0-9-]+$/,
      'slug must be lowercase letters, numbers, or hyphens',
    ),
  body: z.string().max(50_000),
  published: z.boolean(),
});

@Controller('admin/news')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.EVENTS_MANAGE)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  async listNews(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.content.listNews(auth.organisationId);
  }

  @Post()
  async upsertNews(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = parseBody(upsertNewsSchema, body);
    return this.content.upsertNews({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: parsed.id,
      eventId: parsed.eventId,
      title: parsed.title,
      slug: parsed.slug,
      body: parsed.body,
      published: parsed.published,
    });
  }
}
