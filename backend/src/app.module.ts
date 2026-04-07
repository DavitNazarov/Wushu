import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
    // Two buckets: a permissive global one and a strict "short" one for auth endpoints.
    // Controllers/methods that need different limits use @Throttle({ ... }) to override.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,  // 1 minute
        limit: 120,   // 120 req/min per IP — reasonable for normal browsing
      },
      {
        name: 'short',
        ttl: 10_000,  // 10 seconds
        limit: 10,    // 10 req/10s burst guard
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
  providers: [
    // Apply throttling globally to every route so individual controllers
    // that forget @UseGuards(ThrottlerGuard) are still protected.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
