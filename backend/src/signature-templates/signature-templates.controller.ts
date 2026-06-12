import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { CapabilityGuard } from '../auth/capability.guard';
import { RequireCapability } from '../auth/capability.decorator';
import { CAPABILITIES } from '../auth/capabilities';
import { SignatureTemplatesService } from './signature-templates.service';
import { createSignatureTemplateSchema } from './signature-templates.schemas';

// Admin routes for managing head-judge signature templates, mounted at
// `/api/signature-templates`. Gated by EXPORTS_MANAGE like the rest of exports.
@Controller('signature-templates')
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(CAPABILITIES.EXPORTS_MANAGE)
export class SignatureTemplatesController {
  constructor(private readonly svc: SignatureTemplatesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.svc.list(req.auth!.organisationId);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = createSignatureTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'INVALID_INPUT', code: 'INVALID_INPUT' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.svc.create(
      req.auth!.organisationId,
      req.auth!.sub,
      parsed.data,
    );
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.svc.remove(req.auth!.organisationId, req.auth!.sub, id);
  }
}
