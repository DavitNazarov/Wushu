import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';

@Controller('users')
@UseGuards(AuthGuard, CapabilityGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequireCapability(CAPABILITIES.ATHLETES_MANAGE)
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.users.list(auth.organisationId);
  }
}
