import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { RulesetsService } from './rulesets.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { Req } from '@nestjs/common';

@Controller('rulesets')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.CAN_MANAGE_RULESETS)
export class RulesetsController {
  constructor(private readonly rulesets: RulesetsService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.rulesets.list(auth.organisationId);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: { name: string; definition: unknown }) {
    const auth = req.auth!;
    return this.rulesets.create({
      organisationId: auth.organisationId,
      name: body.name,
      definition: body.definition,
      actorUserId: auth.sub,
    });
  }
}
