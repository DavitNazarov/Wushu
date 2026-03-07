import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

type ZodMetatype = {
  schema?: ZodTypeAny;
};

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const metatype = metadata.metatype as ZodMetatype | undefined;
    const schema = metatype?.schema;
    if (!schema) return value;

    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;

    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
