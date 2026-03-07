import { Module } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FormsController],
})
export class FormsModule {}
