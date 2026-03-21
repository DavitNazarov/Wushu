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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CAPABILITIES } from '../auth/capabilities';
import { RequireCapability } from '../auth/capability.decorator';
import { CapabilityGuard } from '../auth/capability.guard';
import { CategoryTemplateAdminService } from './category-template-admin.service';
import { CategoryTemplatesService } from './category-templates.service';
import {
  CategoryTemplateListQuerySchema,
  CreateCategoryTemplateSchema,
  UpdateCategoryTemplateSchema,
} from './category-template.schemas';

function validationIssues(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

@Controller()
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.RULESETS_MANAGE)
export class CategoryTemplatesController {
  constructor(
    private readonly categoryTemplates: CategoryTemplatesService,
    private readonly categoryTemplateAdmin: CategoryTemplateAdminService,
  ) {}

  @Get('category-options')
  async listCategoryOptions() {
    return this.categoryTemplates.listCategoryOptions();
  }

  @Get('category-templates')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const auth = req.auth!;
    const parsed = CategoryTemplateListQuerySchema.safeParse({ q, status, type });
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category template filters',
          issues: validationIssues(parsed.error),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return this.categoryTemplateAdmin.list(auth.organisationId, parsed.data);
  }

  @Post('category-templates')
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const auth = req.auth!;
    const parsed = CreateCategoryTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category template payload',
          issues: validationIssues(parsed.error),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.categoryTemplates.create({
        organisationId: auth.organisationId,
        name: parsed.data.name,
        categoryOptionIds: parsed.data.categoryOptionIds,
        status: parsed.data.status,
        actorUserId: auth.sub,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (
        message === 'CATEGORY_OPTION_NOT_FOUND' ||
        message === 'AT_LEAST_ONE_CATEGORY_OPTION_REQUIRED' ||
        message === 'INVALID_AGE_RANGE' ||
        message === 'INVALID_WEIGHT_RANGE' ||
        message === 'DUPLICATE_AGE_GROUP_CODE' ||
        message === 'DUPLICATE_AGE_GROUP_SORT_ORDER' ||
        message === 'OPEN_WEIGHT_CATEGORY_MUST_BE_LAST' ||
        message === 'WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING'
      ) {
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }

  @Get('category-templates/:id')
  async getDetail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;

    try {
      return await this.categoryTemplateAdmin.getDetail(auth.organisationId, id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'CATEGORY_TEMPLATE_NOT_FOUND') {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  @Patch('category-templates/:id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const auth = req.auth!;
    const parsed = UpdateCategoryTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category template payload',
          issues: validationIssues(parsed.error),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      return await this.categoryTemplateAdmin.update({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        categoryTemplateId: id,
        dto: parsed.data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'CATEGORY_TEMPLATE_NOT_FOUND') {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      if (
        message === 'SYSTEM_CATEGORY_TEMPLATE_PROTECTED' ||
        message === 'CATEGORY_TEMPLATE_STRUCTURE_LOCKED_BY_USAGE'
      ) {
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      if (
        message === 'CATEGORY_OPTION_NOT_FOUND' ||
        message === 'AT_LEAST_ONE_CATEGORY_OPTION_REQUIRED' ||
        message === 'INVALID_AGE_RANGE' ||
        message === 'INVALID_WEIGHT_RANGE' ||
        message === 'DUPLICATE_AGE_GROUP_CODE' ||
        message === 'DUPLICATE_AGE_GROUP_SORT_ORDER' ||
        message === 'OPEN_WEIGHT_CATEGORY_MUST_BE_LAST' ||
        message === 'WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING'
      ) {
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }

  @Post('category-templates/:id/activate')
  async activate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;
    try {
      return await this.categoryTemplates.activate({
        organisationId: auth.organisationId,
        categoryTemplateId: id,
        actorUserId: auth.sub,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'CATEGORY_TEMPLATE_NOT_FOUND') {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  @Get('category-templates/:id/categories')
  async getCategories(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const auth = req.auth!;
    try {
      return await this.categoryTemplates.getCategoryTree(auth.organisationId, id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'CATEGORY_TEMPLATE_NOT_FOUND') {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  @Delete('category-templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const auth = req.auth!;

    try {
      await this.categoryTemplateAdmin.remove({
        organisationId: auth.organisationId,
        actorUserId: auth.sub,
        categoryTemplateId: id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'CATEGORY_TEMPLATE_NOT_FOUND') {
        throw new HttpException(message, HttpStatus.NOT_FOUND);
      }
      if (
        message === 'SYSTEM_CATEGORY_TEMPLATE_PROTECTED' ||
        message === 'ACTIVE_CATEGORY_TEMPLATE_DELETE_FORBIDDEN' ||
        message === 'CATEGORY_TEMPLATE_IN_USE'
      ) {
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }
}
