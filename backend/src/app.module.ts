import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { RulesetsModule } from './rulesets/rulesets.module';
import { ContentModule } from './content/content.module';
import { PublicModule } from './public/public.module';
import { FormsModule } from './forms/forms.module';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    EventsModule,
    RulesetsModule,
    ContentModule,
    PublicModule,
    FormsModule,
  ],
})
export class AppModule {}
