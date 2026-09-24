import { z } from 'zod';

const eventTypeNameSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/, {
  message: 'Event types must use UPPER_SNAKE_CASE.',
});

export const EVENT_REGISTRY_CONVENTION = {
  naming: 'UPPER_SNAKE_CASE',
  versionField: 'version',
  idempotencyField: 'idempotencyKey',
  sensitiveData: 'References are preferred over raw secrets or unnecessary personal data.',
} as const;

export interface EventTypeDefinition<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  name: z.infer<typeof eventTypeNameSchema>;
  version: number;
  ownerModule: string;
  payloadSchema: z.ZodType<TPayload>;
}

export function defineEvent<TPayload extends Record<string, unknown>>(
  definition: EventTypeDefinition<TPayload>,
): EventTypeDefinition<TPayload> {
  eventTypeNameSchema.parse(definition.name);
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error('Event versions must be positive integers.');
  }
  if (!definition.ownerModule.trim()) {
    throw new Error('Event definitions must identify an owning module.');
  }
  return definition;
}
