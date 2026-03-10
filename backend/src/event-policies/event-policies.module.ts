import { Module } from '@nestjs/common';
import { EventPoliciesService } from './event-policies.service';
import { EventPoliciesController } from './event-policies.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EventPoliciesController],
  providers: [EventPoliciesService],
  exports: [EventPoliciesService],
})
export class EventPoliciesModule {}
