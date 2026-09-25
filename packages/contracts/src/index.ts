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

export const skillProficiencySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']);
export type SkillProficiency = z.infer<typeof skillProficiencySchema>;
export const learningPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type LearningPriority = z.infer<typeof learningPrioritySchema>;
export const dayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export const certificationStatusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED']);
export type CertificationStatus = z.infer<typeof certificationStatusSchema>;

export const externalUrlSchema = profileUrlSchema;
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD).')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Use a valid calendar date.');
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm time.');
const optionalExternalUrlSchema = externalUrlSchema.nullable().optional();
const optionalDateSchema = dateOnlySchema.nullable().optional();
const requiredTextSchema = (maxLength: number) => profileTextSchema(maxLength);
const optionalTextFieldSchema = (maxLength: number) =>
  profileTextSchema(maxLength).nullable().optional();

const dateRangeRefinement = (
  value: { issueDate?: string | null; expiryDate?: string | null },
  ctx: { addIssue: (issue: { code: 'custom'; message: string; path: string[] }) => void },
) => {
  if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'Expiry date cannot be before issue date.',
      path: ['expiryDate'],
    });
  }
};

export const createLearningGoalRequestSchema = z
  .object({
    skillId: idSchema,
    currentLevel: skillProficiencySchema.default('BEGINNER'),
    targetLevel: skillProficiencySchema,
    description: optionalTextFieldSchema(2000),
    priority: learningPrioritySchema.default('MEDIUM'),
  })
  .strict();
export type CreateLearningGoalRequest = z.infer<typeof createLearningGoalRequestSchema>;
export const updateLearningGoalRequestSchema = createLearningGoalRequestSchema
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one learning goal field is required.',
  );
export type UpdateLearningGoalRequest = z.infer<typeof updateLearningGoalRequestSchema>;
export const learningGoalResponseSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    skillId: idSchema,
    skillName: z.string(),
    currentLevel: skillProficiencySchema,
    targetLevel: skillProficiencySchema,
    description: z.string().nullable(),
    priority: learningPrioritySchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type LearningGoal = z.infer<typeof learningGoalResponseSchema>;

export const createAvailabilityRequestSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    timezone: z.string().trim().min(1).max(64).default('UTC'),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((value) => value.startTime < value.endTime, 'Start time must be before end time.');
export type CreateAvailabilityRequest = z.infer<typeof createAvailabilityRequestSchema>;
export const updateAvailabilityRequestSchema = createAvailabilityRequestSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one availability field is required.')
  .refine(
    (value) => !value.startTime || !value.endTime || value.startTime < value.endTime,
    'Start time must be before end time.',
  );
export type UpdateAvailabilityRequest = z.infer<typeof updateAvailabilityRequestSchema>;
export const availabilityResponseSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    dayOfWeek: dayOfWeekSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    timezone: z.string(),
    isActive: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type Availability = z.infer<typeof availabilityResponseSchema>;

export const createCertificationRequestSchema = z
  .object({
    title: requiredTextSchema(160),
    issuingOrganization: requiredTextSchema(160),
    credentialId: optionalTextFieldSchema(160),
    issueDate: optionalDateSchema,
    expiryDate: optionalDateSchema,
    proofUrl: optionalExternalUrlSchema,
  })
  .strict()
  .superRefine(dateRangeRefinement);
export type CreateCertificationRequest = z.infer<typeof createCertificationRequestSchema>;
export const updateCertificationRequestSchema = createCertificationRequestSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one certification field is required.')
  .superRefine(dateRangeRefinement);
export type UpdateCertificationRequest = z.infer<typeof updateCertificationRequestSchema>;
export const certificationResponseSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    title: z.string(),
    issuingOrganization: z.string(),
    credentialId: z.string().nullable(),
    issueDate: dateOnlySchema.nullable(),
    expiryDate: dateOnlySchema.nullable(),
    proofUrl: externalUrlSchema.nullable(),
    status: certificationStatusSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type Certification = z.infer<typeof certificationResponseSchema>;

export const createProjectRequestSchema = z
  .object({
    title: requiredTextSchema(160),
    description: requiredTextSchema(4000),
    technologies: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
    projectUrl: optionalExternalUrlSchema,
    repositoryUrl: optionalExternalUrlSchema,
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'End date cannot be before start date.',
        path: ['endDate'],
      });
    }
  });
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export const updateProjectRequestSchema = createProjectRequestSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one project field is required.')
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'End date cannot be before start date.',
        path: ['endDate'],
      });
    }
  });
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export const projectResponseSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    title: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
    projectUrl: externalUrlSchema.nullable(),
    repositoryUrl: externalUrlSchema.nullable(),
    startDate: dateOnlySchema.nullable(),
    endDate: dateOnlySchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type Project = z.infer<typeof projectResponseSchema>;

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

export const discoveryUserQuerySchema = z
  .object({
    skill: z.string().trim().min(1).max(120).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((value) => Boolean(value.skill || value.search), {
    message: 'Provide skill or search.',
  });
export type DiscoveryUserQuery = z.infer<typeof discoveryUserQuerySchema>;

export const discoverySkillSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    proficiency: skillProficiencySchema,
    description: z.string().nullable(),
  })
  .strict();
export type DiscoverySkill = z.infer<typeof discoverySkillSchema>;

export const discoveryUserSchema = z
  .object({
    userId: idSchema,
    displayName: z.string(),
    profileImageUrl: z.string().nullable(),
    department: z.string().nullable(),
    institution: z.string().nullable(),
    bio: z.string().nullable(),
    skills: z.array(discoverySkillSchema),
  })
  .strict();
export type DiscoveryUser = z.infer<typeof discoveryUserSchema>;

export const discoveryUsersResponseSchema = createPaginatedResponseSchema(discoveryUserSchema);

export const matchingQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type MatchingQuery = z.infer<typeof matchingQuerySchema>;

const matchingSkillReferenceSchema = z.object({ id: idSchema, name: z.string() }).strict();
export const matchingUserSchema = z
  .object({
    userId: idSchema,
    displayName: z.string(),
    relevantSkills: z.array(matchingSkillReferenceSchema),
    relevantLearningGoals: z.array(
      z.object({ id: idSchema, skill: matchingSkillReferenceSchema }).strict(),
    ),
    matchScore: z.number().int().nonnegative(),
    reasons: z.array(z.string()),
    mutual: z.boolean(),
  })
  .strict();
export type MatchingUser = z.infer<typeof matchingUserSchema>;
export const matchingUsersResponseSchema = createPaginatedResponseSchema(matchingUserSchema);

export const exchangePairSchema = z
  .object({
    skillYouCanTeach: matchingSkillReferenceSchema,
    skillTheyCanTeach: matchingSkillReferenceSchema,
  })
  .strict();
export const mutualExchangeSchema = z
  .object({
    partnerUserId: idSchema,
    displayName: z.string(),
    exchangePairs: z.array(exchangePairSchema),
    explanation: z.string(),
  })
  .strict();
export type MutualExchange = z.infer<typeof mutualExchangeSchema>;
export const mutualExchangesResponseSchema = createPaginatedResponseSchema(mutualExchangeSchema);

export const sessionRequestStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED']);
export type SessionRequestStatus = z.infer<typeof sessionRequestStatusSchema>;

export const createSessionRequestSchema = z
  .object({
    recipientUserId: idSchema,
    skillId: idSchema.optional(),
    message: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const updateSessionRequestSchema = z
  .object({
    status: z.enum(['ACCEPTED', 'DECLINED', 'CANCELLED']),
  })
  .strict();
export type UpdateSessionRequest = z.infer<typeof updateSessionRequestSchema>;

export const sessionRequestQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type SessionRequestQuery = z.infer<typeof sessionRequestQuerySchema>;

const sessionRequestIdentitySchema = z
  .object({ userId: idSchema, displayName: z.string() })
  .strict();
const sessionRequestSkillSchema = z.object({ id: idSchema, name: z.string() }).strict();
export const sessionRequestSchema = z
  .object({
    id: idSchema,
    requester: sessionRequestIdentitySchema,
    recipient: sessionRequestIdentitySchema,
    skill: sessionRequestSkillSchema.nullable(),
    message: z.string().nullable(),
    status: sessionRequestStatusSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type SessionRequest = z.infer<typeof sessionRequestSchema>;
export const sessionRequestsResponseSchema = createPaginatedResponseSchema(sessionRequestSchema);

export const sessionRequestEventPayloadSchema = z
  .object({
    requestId: idSchema,
    requesterUserId: idSchema,
    recipientUserId: idSchema,
    skillId: idSchema.nullable(),
    status: sessionRequestStatusSchema,
  })
  .strict();
export type SessionRequestEventPayload = z.infer<typeof sessionRequestEventPayloadSchema>;

export const requestSentEventDefinition = defineEvent({
  name: 'REQUEST_SENT',
  version: 1,
  ownerModule: 'requests',
  payloadSchema: sessionRequestEventPayloadSchema,
});
export const requestAcceptedEventDefinition = defineEvent({
  name: 'REQUEST_ACCEPTED',
  version: 1,
  ownerModule: 'requests',
  payloadSchema: sessionRequestEventPayloadSchema,
});
export const requestDeclinedEventDefinition = defineEvent({
  name: 'REQUEST_DECLINED',
  version: 1,
  ownerModule: 'requests',
  payloadSchema: sessionRequestEventPayloadSchema,
});
export const requestCancelledEventDefinition = defineEvent({
  name: 'REQUEST_CANCELLED',
  version: 1,
  ownerModule: 'requests',
  payloadSchema: sessionRequestEventPayloadSchema,
});

const sessionTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Timezone must be a valid IANA timezone.');

export const sessionModeSchema = z.enum(['ONLINE', 'OFFLINE']);
export type SessionMode = z.infer<typeof sessionModeSchema>;
export const sessionStatusSchema = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const createSessionSchema = z
  .object({
    sessionRequestId: idSchema,
    mode: sessionModeSchema,
    scheduledStart: z.string().datetime({ offset: true }),
    scheduledEnd: z.string().datetime({ offset: true }),
    timezone: sessionTimezoneSchema,
    meetingUrl: externalUrlSchema.optional(),
    locationDetails: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.scheduledStart).getTime() >= new Date(value.scheduledEnd).getTime()) {
      ctx.addIssue({
        code: 'custom',
        message: 'scheduledStart must be before scheduledEnd.',
        path: ['scheduledEnd'],
      });
    }
    if (value.mode === 'OFFLINE') {
      if (!value.locationDetails) {
        ctx.addIssue({
          code: 'custom',
          message: 'OFFLINE sessions require locationDetails.',
          path: ['locationDetails'],
        });
      }
      if (value.meetingUrl !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'OFFLINE sessions cannot use a meeting URL.',
          path: ['meetingUrl'],
        });
      }
    }
  });
export type CreateSession = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = z
  .object({
    status: sessionStatusSchema.optional(),
    locationDetails: z.string().trim().min(1).max(1000).nullable().optional(),
    meetingUrl: externalUrlSchema.nullable().optional(),
    scheduledStart: z.string().datetime({ offset: true }).optional(),
    scheduledEnd: z.string().datetime({ offset: true }).optional(),
    timezone: sessionTimezoneSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one Session field is required.')
  .superRefine((value, ctx) => {
    if (
      value.scheduledStart !== undefined &&
      value.scheduledEnd !== undefined &&
      new Date(value.scheduledStart).getTime() >= new Date(value.scheduledEnd).getTime()
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'scheduledStart must be before scheduledEnd.',
        path: ['scheduledEnd'],
      });
    }
  });
export type UpdateSession = z.infer<typeof updateSessionSchema>;

export const sessionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type SessionQuery = z.infer<typeof sessionQuerySchema>;

const sessionIdentitySchema = z.object({ userId: idSchema, displayName: z.string() }).strict();
const sessionSkillSchema = z.object({ id: idSchema, name: z.string() }).strict();
export const sessionSchema = z
  .object({
    id: idSchema,
    sessionRequestId: idSchema,
    host: sessionIdentitySchema,
    participant: sessionIdentitySchema,
    skill: sessionSkillSchema.nullable(),
    mode: sessionModeSchema,
    status: sessionStatusSchema,
    scheduledStart: timestampSchema,
    scheduledEnd: timestampSchema,
    timezone: z.string(),
    meetingUrl: externalUrlSchema.nullable(),
    locationDetails: z.string().nullable(),
    googleConferenceStatus: z.enum(['PENDING', 'READY', 'FAILED']).nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type Session = z.infer<typeof sessionSchema>;
export const sessionsResponseSchema = createPaginatedResponseSchema(sessionSchema);

export const sessionEventPayloadSchema = z
  .object({
    sessionId: idSchema,
    sessionRequestId: idSchema,
    hostUserId: idSchema,
    participantUserId: idSchema,
    skillId: idSchema.nullable(),
    mode: sessionModeSchema,
    status: sessionStatusSchema,
    scheduledStart: timestampSchema,
    scheduledEnd: timestampSchema,
    timezone: z.string(),
  })
  .strict();
export type SessionEventPayload = z.infer<typeof sessionEventPayloadSchema>;

export const sessionScheduledEventDefinition = defineEvent({
  name: 'SESSION_SCHEDULED',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionEventPayloadSchema,
});
export const sessionUpdatedEventDefinition = defineEvent({
  name: 'SESSION_UPDATED',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionEventPayloadSchema,
});
export const sessionStartedEventDefinition = defineEvent({
  name: 'SESSION_STARTED',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionEventPayloadSchema,
});
export const sessionCompletedEventDefinition = defineEvent({
  name: 'SESSION_COMPLETED',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionEventPayloadSchema,
});
export const sessionCancelledEventDefinition = defineEvent({
  name: 'SESSION_CANCELLED',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionEventPayloadSchema,
});
export const sessionNoShowEventDefinition = defineEvent({
  name: 'SESSION_NO_SHOW',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionEventPayloadSchema,
});

export const sessionReminderTypeSchema = z.enum(['TWENTY_FOUR_HOURS', 'ONE_HOUR', 'TEN_MINUTES']);
export type SessionReminderType = z.infer<typeof sessionReminderTypeSchema>;
export const sessionReminderStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']);
export type SessionReminderStatus = z.infer<typeof sessionReminderStatusSchema>;

export const sessionReminderSchema = z
  .object({
    id: idSchema,
    sessionId: idSchema,
    reminderType: sessionReminderTypeSchema,
    scheduledFor: timestampSchema,
    status: sessionReminderStatusSchema,
    sentAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
  })
  .strict();
export type SessionReminder = z.infer<typeof sessionReminderSchema>;

export const sessionReminderEventPayloadSchema = z
  .object({
    reminderId: idSchema,
    sessionId: idSchema,
    reminderType: sessionReminderTypeSchema,
    scheduledFor: timestampSchema,
  })
  .strict();
export type SessionReminderEventPayload = z.infer<typeof sessionReminderEventPayloadSchema>;

export const sessionReminder24hEventDefinition = defineEvent({
  name: 'SESSION_REMINDER_24H',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionReminderEventPayloadSchema,
});
export const sessionReminder1hEventDefinition = defineEvent({
  name: 'SESSION_REMINDER_1H',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionReminderEventPayloadSchema,
});
export const sessionReminder10mEventDefinition = defineEvent({
  name: 'SESSION_REMINDER_10M',
  version: 1,
  ownerModule: 'sessions',
  payloadSchema: sessionReminderEventPayloadSchema,
});

export const ratingValueSchema = z.number().int().min(1).max(5);
export type RatingValue = z.infer<typeof ratingValueSchema>;
export const createRatingSchema = z
  .object({
    sessionId: idSchema,
    rating: ratingValueSchema,
    feedback: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export type CreateRating = z.infer<typeof createRatingSchema>;

const ratingIdentitySchema = z.object({ userId: idSchema, displayName: z.string() }).strict();
export const ratingSchema = z
  .object({
    id: idSchema,
    sessionId: idSchema,
    rater: ratingIdentitySchema,
    ratedUser: ratingIdentitySchema,
    rating: ratingValueSchema,
    feedback: z.string().nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type Rating = z.infer<typeof ratingSchema>;

export const ratingSubmittedEventPayloadSchema = z
  .object({
    ratingId: idSchema,
    sessionId: idSchema,
    raterUserId: idSchema,
    ratedUserId: idSchema,
    rating: ratingValueSchema,
  })
  .strict();
export type RatingSubmittedEventPayload = z.infer<typeof ratingSubmittedEventPayloadSchema>;
export const ratingSubmittedEventDefinition = defineEvent({
  name: 'RATING_SUBMITTED',
  version: 1,
  ownerModule: 'ratings',
  payloadSchema: ratingSubmittedEventPayloadSchema,
});

export const badgeDefinitionSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(1000),
    code: z.string().min(1).max(64),
    iconUrl: z.string().max(2048).nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type BadgeDefinition = z.infer<typeof badgeDefinitionSchema>;

export const userBadgeSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    badgeDefinitionId: idSchema,
    awardedAt: timestampSchema,
    badgeDefinition: badgeDefinitionSchema,
  })
  .strict();
export type UserBadge = z.infer<typeof userBadgeSchema>;

export const badgeEarnedEventPayloadSchema = z
  .object({
    userBadgeId: idSchema,
    userId: idSchema,
    badgeDefinitionId: idSchema,
  })
  .strict();
export type BadgeEarnedEventPayload = z.infer<typeof badgeEarnedEventPayloadSchema>;
export const badgeEarnedEventDefinition = defineEvent({
  name: 'BADGE_EARNED',
  version: 1,
  ownerModule: 'badges',
  payloadSchema: badgeEarnedEventPayloadSchema,
});

export const assessmentScoreSchema = z.number().int().min(1).max(5);
export const createAssessmentSchema = z
  .object({
    sessionId: idSchema,
    skillId: idSchema.optional(),
    understandingScore: assessmentScoreSchema,
    practicalApplicationScore: assessmentScoreSchema,
    problemSolvingScore: assessmentScoreSchema,
    communicationScore: assessmentScoreSchema,
    reliabilityScore: assessmentScoreSchema,
    feedback: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export type CreateAssessment = z.infer<typeof createAssessmentSchema>;

const assessmentIdentitySchema = z.object({ userId: idSchema, displayName: z.string() }).strict();
const assessmentSkillSchema = z.object({ id: idSchema, name: z.string() }).strict();
export const assessmentSchema = z
  .object({
    id: idSchema,
    sessionId: idSchema,
    assessor: assessmentIdentitySchema,
    assessedUser: assessmentIdentitySchema,
    skill: assessmentSkillSchema.nullable(),
    understandingScore: assessmentScoreSchema,
    practicalApplicationScore: assessmentScoreSchema,
    problemSolvingScore: assessmentScoreSchema,
    communicationScore: assessmentScoreSchema,
    reliabilityScore: assessmentScoreSchema,
    feedback: z.string().nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export type Assessment = z.infer<typeof assessmentSchema>;

export const assessmentSubmittedEventPayloadSchema = z
  .object({
    assessmentId: idSchema,
    sessionId: idSchema,
    assessorUserId: idSchema,
    assessedUserId: idSchema,
    skillId: idSchema.nullable(),
  })
  .strict();
export type AssessmentSubmittedEventPayload = z.infer<typeof assessmentSubmittedEventPayloadSchema>;
export const assessmentSubmittedEventDefinition = defineEvent({
  name: 'ASSESSMENT_SUBMITTED',
  version: 1,
  ownerModule: 'assessments',
  payloadSchema: assessmentSubmittedEventPayloadSchema,
});

const reputationMetricSchema = z.number().min(1).max(5).nullable();
export const assessmentAveragesSchema = z
  .object({
    understandingScore: reputationMetricSchema,
    practicalApplicationScore: reputationMetricSchema,
    problemSolvingScore: reputationMetricSchema,
    communicationScore: reputationMetricSchema,
    reliabilityScore: reputationMetricSchema,
  })
  .strict();
export const reputationSummarySchema = z
  .object({
    userId: idSchema,
    completedSessions: z.number().int().nonnegative(),
    averageRating: reputationMetricSchema,
    ratingCount: z.number().int().nonnegative(),
    assessmentCount: z.number().int().nonnegative(),
    assessmentAverages: assessmentAveragesSchema,
    badgeCount: z.number().int().nonnegative(),
  })
  .strict();
export type ReputationSummary = z.infer<typeof reputationSummarySchema>;

export const googleConnectionStatusSchema = z
  .object({
    connected: z.boolean(),
    scopes: z.array(z.string()).default([]),
    expiresAt: timestampSchema.nullable().optional(),
  })
  .strict();
export type GoogleConnectionStatus = z.infer<typeof googleConnectionStatusSchema>;
export const googleConnectResponseSchema = z
  .object({ authorizationUrl: z.string().url() })
  .strict();
export type GoogleConnectResponse = z.infer<typeof googleConnectResponseSchema>;

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
