import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventOpsService } from './event-ops.service';
import { EventsController } from './events.controller';
import { EventStageAutomationService } from './event-stage-automation.service';
import { EventCategoriesService } from './event-categories.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CategoryTemplatesModule } from '../category-templates/category-templates.module';

// Nest module that owns the Event aggregate (create/list/update/delete) plus
// supporting services:
//   - EventsService: CRUD + reads
//   - EventOpsService: lifecycle transitions (REG_OPEN → LOCKED → ...)
//   - EventStageAutomationService: cron-driven auto-advance of stages
//   - EventCategoriesService: per-event category configuration
// Exports every service because draw/, schedule/, weighin/, etc. consume them.
@Module({
  imports: [PrismaModule, AuthModule, CategoryTemplatesModule],
  controllers: [EventsController],
  providers: [
    EventsService,
    EventOpsService,
    EventStageAutomationService,
    EventCategoriesService,
  ],
  exports: [
    EventsService,
    EventOpsService,
    EventStageAutomationService,
    EventCategoriesService,
  ],
})
export class EventsModule {}
