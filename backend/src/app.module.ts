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
import { GeographyModule } from './geography/geography.module';
import { CoachesModule } from './coaches/coaches.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { WeighinModule } from './weighin/weighin.module';
import { IntegrityModule } from './integrity/integrity.module';
import { DrawModule } from './draw/draw.module';
import { ScheduleModule } from './schedule/schedule.module';
import { FightsModule } from './fights/fights.module';
import { UsersModule } from './users/users.module';
import { ResultsModule } from './results/results.module';
import { ExportsModule } from './exports/exports.module';
import { SignatureTemplatesModule } from './signature-templates/signature-templates.module';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { OriginCheckMiddleware } from './common/origin-check.middleware';
import { EventPoliciesModule } from './event-policies/event-policies.module';
import { HealthController } from './health.controller';
import { THROTTLE } from './config/throttle-config';

// Root Nest module. Composes every feature module and wires global cross-cutting
// concerns: rate-limiting (ThrottlerModule), the cron runner used by event-policies
// (NestScheduleModule), and the per-request logger middleware. Order of `imports`
// doesn't matter functionally — Nest builds the dependency graph from providers.
@Module({
  imports: [
    NestScheduleModule.forRoot(),
    // Two buckets: a permissive global one and a strict "short" one for auth endpoints.
    // Controllers/methods that need different limits use @Throttle({ ... }) to override.
    // Defaults (120 req/min + 10 req/10s per IP) are unchanged in prod; the
    // values come from THROTTLE so load tests can raise them via env.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: THROTTLE.defaultTtl,
        limit: THROTTLE.defaultLimit,
      },
      {
        name: 'short',
        ttl: THROTTLE.shortTtl,
        limit: THROTTLE.shortLimit,
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
    GeographyModule,
    CoachesModule,
    RegistrationsModule,
    WeighinModule,
    IntegrityModule,
    DrawModule,
    ScheduleModule,
    FightsModule,
    UsersModule,
    ResultsModule,
    ExportsModule,
    SignatureTemplatesModule,
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
  // configure() is called once at startup by Nest. We attach the request logger
  // middleware to every route ('*') so every inbound HTTP request gets a structured
  // pino log line with method, path, status, and duration. OriginCheckMiddleware
  // runs after it as a CSRF defense-in-depth layer on state-changing requests.
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware, OriginCheckMiddleware)
      .forRoutes('*');
  }
}
