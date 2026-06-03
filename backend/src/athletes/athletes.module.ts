import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { AthletesService } from './athletes.service';
import { AthletesController } from './athletes.controller';
import { AthleteProfileService } from './athlete-profile.service';

// Athletes module: admin + coach routes for athlete CRUD plus the public
// athlete profile read service.
//   - AthletesService: admin/coach mutations (kept inside this module)
//   - AthleteProfileService: read-only profile assembly, exported because
//     the public/ module renders the bilingual profile page from it.
@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [AthletesService, AthleteProfileService],
  controllers: [AthletesController],
  exports: [AthleteProfileService],
})
export class AthletesModule {}
