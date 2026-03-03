import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { Req } from '@nestjs/common';

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
  async upsertNews(
    @Req() req: AuthenticatedRequest,
    @Body() body: { id?: string; title: string; slug: string; body: string; published: boolean },
  ) {
    const auth = req.auth!;
    return this.content.upsertNews({
      organisationId: auth.organisationId,
      actorUserId: auth.sub,
      id: body.id,
      title: body.title,
      slug: body.slug,
      body: body.body,
      published: body.published,
    });
  }
}
