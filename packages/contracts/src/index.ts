import { z } from 'zod';
import { defineEvent } from './event-registry';

export const runtimeEnvironments = ['development', 'test', 'production'] as const;
export type RuntimeEnvironment = (typeof runtimeEnvironments)[number];

export const systemRoleSchema = z.enum(['USER', 'ADMIN']);
export type SystemRole = z.infer<typeof systemRoleSchema>;

export const accountStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const profileVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;

export const idSchema = z.string().uuid();
export type PublicId = z.infer<typeof idSchema>;

export const timestampSchema = z.string().datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof timestampSchema>;

export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'AUTHENTICATION_REQUIRED',
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_SESSION_REQUIRED',
  'AUTH_SESSION_EXPIRED',
  'AUTH_ACCOUNT_SUSPENDED',
  'AUTH_EMAIL_ALREADY_EXISTS',
  'AUTH_INVALID_INPUT',
  'AUTH_FORBIDDEN',
  'PROFILE_INVALID_INPUT',
  'PROFILE_NOT_FOUND',
  'PROFILE_ALREADY_EXISTS',
  'PROFILE_FORBIDDEN',
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

export const registerRequestSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320),
    password: z.string().min(12).max(128),
  })
  .strict();
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z
  .object({
    id: idSchema,
    email: z.string().email(),
    displayName: z.string(),
    status: accountStatusSchema,
    roles: z.array(systemRoleSchema),
    createdAt: timestampSchema,
  })
  .strict();
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionSchema = z
  .object({
    expiresAt: timestampSchema,
  })
  .strict();
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authResponseSchema = z
  .object({
    user: authUserSchema,
    session: authSessionSchema,
  })
  .strict();
export type AuthResponse = z.infer<typeof authResponseSchema>;

const profileTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.charCodeAt(0);
          return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
        }),
      'Text contains unsupported control characters.',
    );

const profileUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, 'URLs must be credential-free HTTP or HTTPS URLs.');

export const profileImageReferenceSchema = profileUrlSchema;
export type ProfileImageReference = z.infer<typeof profileImageReferenceSchema>;

const profileInterestSchema = profileTextSchema(80).transform((value) =>
  value.replace(/\s+/g, ' '),
);
const profileInterestsSchema = z.array(profileInterestSchema).max(20);
const profileOptionalTextSchema = (maxLength: number) =>
  profileTextSchema(maxLength).nullable().optional();
const profileOptionalUrlSchema = profileUrlSchema.nullable().optional();

export const createProfileRequestSchema = z
  .object({
    displayName: profileOptionalTextSchema(120),
    department: profileOptionalTextSchema(120),
    academicYear: profileOptionalTextSchema(32),
    institution: profileOptionalTextSchema(160),
    bio: profileOptionalTextSchema(2000),
    profileImageUrl: profileOptionalUrlSchema,
    interests: profileInterestsSchema.default([]),
    githubUrl: profileOptionalUrlSchema,
    portfolioUrl: profileOptionalUrlSchema,
    visibility: profileVisibilitySchema.default('PUBLIC'),
  })
  .strict();
export type CreateProfileRequest = z.infer<typeof createProfileRequestSchema>;

export const updateProfileRequestSchema = z
  .object({
    displayName: profileOptionalTextSchema(120),
    department: profileOptionalTextSchema(120),
    academicYear: profileOptionalTextSchema(32),
    institution: profileOptionalTextSchema(160),
    bio: profileOptionalTextSchema(2000),
    profileImageUrl: profileOptionalUrlSchema,
    interests: profileInterestsSchema.optional(),
    githubUrl: profileOptionalUrlSchema,
    portfolioUrl: profileOptionalUrlSchema,
    visibility: profileVisibilitySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one profile field is required.');
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const profileResponseSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    displayName: z.string().min(1).max(120),
    department: z.string().nullable(),
    academicYear: z.string().nullable(),
    institution: z.string().nullable(),
    bio: z.string().nullable(),
    profileImageUrl: profileImageReferenceSchema.nullable(),
    interests: z.array(z.string().min(1).max(80)),
    githubUrl: profileUrlSchema.nullable(),
    portfolioUrl: profileUrlSchema.nullable(),
    visibility: profileVisibilitySchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type Profile = z.infer<typeof profileResponseSchema>;

export const profileUpdatedEventPayloadSchema = z
  .object({
    profileId: idSchema,
    userId: idSchema,
    visibility: profileVisibilitySchema,
    changedFields: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/)).max(20),
  })
  .strict();
export type ProfileUpdatedEventPayload = z.infer<typeof profileUpdatedEventPayloadSchema>;

export const profileUpdatedEventDefinition = defineEvent({
  name: 'PROFILE_UPDATED',
  version: 1,
  ownerModule: 'users',
  payloadSchema: profileUpdatedEventPayloadSchema,
});

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
