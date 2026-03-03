import { Module } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FormsController],
})
export class FormsModule {}
