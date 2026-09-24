import {
  BadRequestException,
  Inject,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import type { ApiErrorCode } from '@campus-skill-exchange/contracts';

export const ZOD_SCHEMA_METADATA = 'campus-skill-exchange:zod-schema';

export function ZodSchema(schema: z.ZodType, errorCode: ApiErrorCode = 'VALIDATION_ERROR') {
  return (target: object) => {
    Reflect.defineMetadata(ZOD_SCHEMA_METADATA, { schema, errorCode }, target);
  };
}

@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype;
    if (!metatype) return value;

    const definition = this.reflector.get<
      { schema: z.ZodType; errorCode: ApiErrorCode } | undefined
    >(ZOD_SCHEMA_METADATA, metatype);
    if (!definition) return value;

    const result = definition.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: definition.errorCode,
        message: 'Request validation failed.',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }
}

export const emptyObjectSchema = z.object({}).strict();
