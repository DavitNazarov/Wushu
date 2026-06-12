import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoryOptionsAdminController } from './category-options-admin.controller';
import { CategoryOptionsAdminService } from './category-options-admin.service';
import { CategoryTemplateAdminService } from './category-template-admin.service';
import { CategoryTemplatesController } from './category-templates.controller';
import { CategoryTemplatesService } from './category-templates.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CategoryTemplatesController, CategoryOptionsAdminController],
  providers: [
    CategoryTemplatesService,
    CategoryTemplateAdminService,
    CategoryOptionsAdminService,
  ],
  exports: [CategoryTemplatesService],
})
export class CategoryTemplatesModule {}
