import {
  BadRequestException,
  Inject,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';

export const ZOD_SCHEMA_METADATA = 'campus-skill-exchange:zod-schema';

export function ZodSchema(schema: z.ZodType) {
  return (target: object) => {
    Reflect.defineMetadata(ZOD_SCHEMA_METADATA, schema, target);
  };
}

@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype;
    if (!metatype) return value;

    const schema = this.reflector.get<z.ZodType | undefined>(ZOD_SCHEMA_METADATA, metatype);
    if (!schema) return value;

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }
}

export const emptyObjectSchema = z.object({}).strict();
