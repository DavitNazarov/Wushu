import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  HttpException,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RulesetsService } from './rulesets.service';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import {
  CreateRulesetSchema,
  UpdateRulesetStructureSchema,
} from './ruleset.schemas';

@Controller('rulesets')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.RULESETS_MANAGE)
export class RulesetsController {
  constructor(private readonly rulesets: RulesetsService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const auth = req.auth!;
    return this.rulesets.list(auth.organisationId);
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = CreateRulesetSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid ruleset payload',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.rulesets.create({
        organisationId: auth.organisationId,
        name: parsed.data.name,
        definition: parsed.data.definition ?? {},
        status: parsed.data.status,
        ageGroups: parsed.data.ageGroups,
        actorUserId: auth.sub,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (
        msg === 'INVALID_AGE_RANGE' ||
        msg === 'INVALID_WEIGHT_RANGE' ||
        msg === 'DUPLICATE_AGE_GROUP_CODE' ||
        msg === 'DUPLICATE_AGE_GROUP_SORT_ORDER' ||
        msg === 'OPEN_WEIGHT_CATEGORY_MUST_BE_LAST' ||
        msg === 'WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }

  @Patch(':id/structure')
  async updateStructure(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = UpdateRulesetStructureSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid ruleset structure payload',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.rulesets.updateStructure({
        organisationId: auth.organisationId,
        rulesetId: id,
        actorUserId: auth.sub,
        ageGroups: parsed.data.ageGroups,
        definition: parsed.data.definition,
        status: parsed.data.status,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      if (msg === 'RULESET_NOT_FOUND') {
        throw new HttpException(msg, HttpStatus.NOT_FOUND);
      }
      if (msg === 'SYSTEM_RULESET_READ_ONLY') {
        throw new HttpException(msg, HttpStatus.FORBIDDEN);
      }
      if (
        msg === 'INVALID_AGE_RANGE' ||
        msg === 'INVALID_WEIGHT_RANGE' ||
        msg === 'DUPLICATE_AGE_GROUP_CODE' ||
        msg === 'DUPLICATE_AGE_GROUP_SORT_ORDER' ||
        msg === 'OPEN_WEIGHT_CATEGORY_MUST_BE_LAST' ||
        msg === 'WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING'
      ) {
        throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      }
      throw e;
    }
  }

  @Post(':id/activate')
  async activate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    return this.rulesets.activate({
      organisationId: auth.organisationId,
      rulesetId: id,
      actorUserId: auth.sub,
    });
  }

  @Get(':id/age-groups')
  async getAgeGroups(@Param('id') id: string) {
    return this.rulesets.getAgeGroupTree(id);
  }
}
