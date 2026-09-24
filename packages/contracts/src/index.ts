import { z } from 'zod';

export const runtimeEnvironments = ['development', 'test', 'production'] as const;
export type RuntimeEnvironment = (typeof runtimeEnvironments)[number];

export const systemRoleSchema = z.enum(['USER', 'ADMIN']);
export type SystemRole = z.infer<typeof systemRoleSchema>;

export const idSchema = z.string().uuid();
export type PublicId = z.infer<typeof idSchema>;

export const timestampSchema = z.string().datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof timestampSchema>;

export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    meta: z.object({
      requestId: z.string().min(1),
    }),
  }),
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export const apiSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  meta: z
    .object({
      requestId: z.string().min(1).optional(),
    })
    .optional(),
});
export type ApiSuccessResponse = z.infer<typeof apiSuccessResponseSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export const createPaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(itemSchema),
      pagination: paginationMetaSchema,
    }),
    meta: z
      .object({
        requestId: z.string().min(1).optional(),
      })
      .optional(),
  });

export const eventTypeSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/, {
  message: 'Event types must use UPPER_SNAKE_CASE.',
});
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventEnvelopeSchema = z.object({
  eventId: idSchema,
  eventType: eventTypeSchema,
  version: z.number().int().positive(),
  occurredAt: timestampSchema,
  actorId: idSchema.nullable(),
  entityType: z.string().min(1).max(120),
  entityId: z.string().min(1).max(255),
  correlationId: idSchema.nullable(),
  causationId: idSchema.nullable(),
  idempotencyKey: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  correlationId: string | null;
  causationId: string | null;
  idempotencyKey: string;
  payload: TPayload;
};

export interface AuthenticatedIdentity {
  userId: string;
  issuer: string;
  subject: string;
  roles: SystemRole[];
  claims: Readonly<Record<string, unknown>>;
}

export interface AuthorizationContext {
  identity: AuthenticatedIdentity | null;
  requestId?: string;
}

export interface IdentityProvider {
  readonly name: string;
  verifyAccessToken(token: string): Promise<AuthenticatedIdentity>;
}

export interface TokenVerificationBoundary {
  verify(token: string): Promise<AuthenticatedIdentity>;
}

export const API_ERROR_CODES = apiErrorCodeSchema.options;
export const API_VERSION = 'v1' as const;

export { EVENT_REGISTRY_CONVENTION, defineEvent, type EventTypeDefinition } from './event-registry';
