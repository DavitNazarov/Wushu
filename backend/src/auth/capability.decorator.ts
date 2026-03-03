import { SetMetadata } from '@nestjs/common';
import { REQUIRE_CAPABILITY } from './capability.guard';

export const RequireCapability = (capability: string) =>
  SetMetadata(REQUIRE_CAPABILITY, capability);
