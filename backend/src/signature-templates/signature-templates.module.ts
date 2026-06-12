import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SignatureTemplatesController } from './signature-templates.controller';
import { SignatureTemplatesService } from './signature-templates.service';

// Exports SignatureTemplatesService so the PDF export can embed the chosen
// signature into the results protocols.
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SignatureTemplatesController],
  providers: [SignatureTemplatesService],
  exports: [SignatureTemplatesService],
})
export class SignatureTemplatesModule {}
