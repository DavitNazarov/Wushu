import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { CategoryTemplatesModule } from './category-templates/category-templates.module';
import { ContentModule } from './content/content.module';
import { PublicModule } from './public/public.module';
import { FormsModule } from './forms/forms.module';
import { AthletesModule } from './athletes/athletes.module';
import { ClubsModule } from './clubs/clubs.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { WeighinModule } from './weighin/weighin.module';
import { IntegrityModule } from './integrity/integrity.module';
import { DrawModule } from './draw/draw.module';
import { ScheduleModule } from './schedule/schedule.module';
import { FightsModule } from './fights/fights.module';
import { UsersModule } from './users/users.module';
import { ResultsModule } from './results/results.module';
import { ExportsModule } from './exports/exports.module';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { EventPoliciesModule } from './event-policies/event-policies.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),
    PrismaModule,
    CommonModule,
    AuthModule,
    CategoryTemplatesModule,
    EventsModule,
    ContentModule,
    PublicModule,
    FormsModule,
    AthletesModule,
    ClubsModule,
    RegistrationsModule,
    WeighinModule,
    IntegrityModule,
    DrawModule,
    ScheduleModule,
    FightsModule,
    UsersModule,
    ResultsModule,
    ExportsModule,
    EventPoliciesModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
