import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { CountriesService } from './countries.service';
import { CountriesController } from './countries.controller';
import { RegionsService } from './regions.service';
import { RegionsController } from './regions.controller';

// Geography module: admin CRUD for the Country → Region layer above clubs.
// Services are exported so clubs/users/athletes services can resolve a club's
// region/country when keeping the denormalised copies in sync.
@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [CountriesService, RegionsService],
  controllers: [CountriesController, RegionsController],
  exports: [CountriesService, RegionsService],
})
export class GeographyModule {}
