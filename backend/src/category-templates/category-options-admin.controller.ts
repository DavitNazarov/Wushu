import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CAPABILITIES } from '../auth/capabilities';
import { RequireCapability } from '../auth/capability.decorator';
import { CapabilityGuard } from '../auth/capability.guard';
import { CategoryOptionsAdminService } from './category-options-admin.service';
import {
  CreateCategoryOptionGroupSchema,
  UpdateCategoryOptionGroupSchema,
} from './category-options.schemas';

const STRUCTURE_ERROR_CODES = new Set([
  'INVALID_AGE_RANGE',
  'INVALID_WEIGHT_RANGE',
  'OPEN_WEIGHT_CATEGORY_MUST_BE_LAST',
  'WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING',
  'DUPLICATE_AGE_GROUP_CODE',
  'DUPLICATE_AGE_GROUP_SORT_ORDER',
]);

function validationIssues(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function mapDomainError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  if (message === 'CATEGORY_OPTION_GROUP_NOT_FOUND') {
    throw new HttpException(message, HttpStatus.NOT_FOUND);
  }
  if (STRUCTURE_ERROR_CODES.has(message)) {
    throw new HttpException(message, HttpStatus.BAD_REQUEST);
  }
  throw error;
}

@Controller()
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.RULESETS_MANAGE)
export class CategoryOptionsAdminController {
  constructor(private readonly service: CategoryOptionsAdminService) {}

  @Get('category-option-groups')
  async list() {
    return this.service.list();
  }

  @Post('category-option-groups')
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = CreateCategoryOptionGroupSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category payload',
          issues: validationIssues(parsed.error),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.service.create({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        dto: parsed.data,
      });
    } catch (error) {
      mapDomainError(error);
    }
  }

  @Patch('category-option-groups/:id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = UpdateCategoryOptionGroupSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category payload',
          issues: validationIssues(parsed.error),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.service.update({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        groupId: id,
        dto: parsed.data,
      });
    } catch (error) {
      mapDomainError(error);
    }
  }

  @Delete('category-option-groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    try {
      await this.service.remove({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        groupId: id,
      });
    } catch (error) {
      mapDomainError(error);
    }
  }
}
