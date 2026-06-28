import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { CountriesService } from './countries.service';
import { CountriesController } from './countries.controller';
import { CitiesService } from './cities.service';
import { CitiesController } from './cities.controller';
import { FederationsService } from './federations.service';
import { FederationsController } from './federations.controller';

// Geography module: admin CRUD for the Country → City → Federation layer above
// clubs. Services are exported so clubs/users/athletes services can resolve a
// club's city/country/federation when keeping the denormalised copies in sync.
@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  providers: [CountriesService, CitiesService, FederationsService],
  controllers: [CountriesController, CitiesController, FederationsController],
  exports: [CountriesService, CitiesService, FederationsService],
})
export class GeographyModule {}
