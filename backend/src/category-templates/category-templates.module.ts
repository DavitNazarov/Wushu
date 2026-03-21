import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoryTemplateAdminService } from './category-template-admin.service';
import { CategoryTemplatesController } from './category-templates.controller';
import { CategoryTemplatesService } from './category-templates.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CategoryTemplatesController],
  providers: [CategoryTemplatesService, CategoryTemplateAdminService],
  exports: [CategoryTemplatesService],
})
export class CategoryTemplatesModule {}
