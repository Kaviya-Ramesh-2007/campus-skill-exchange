import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required.')
      .refine((value: string) => /^postgres(?:ql)?:\/\//i.test(value), {
        message: 'DATABASE_URL must be a PostgreSQL connection URL.',
      }),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: z.string().min(1).default('http://localhost:3000'),
    AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(31536000).default(2592000),
    AUTH_SESSION_COOKIE_NAME: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]+$/,
        'Cookie name may contain only letters, numbers, underscores, and hyphens.',
      )
      .default('cse_session'),
    AUTH_SESSION_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    GOOGLE_REDIRECT_URI: z
      .string()
      .url()
      .default('http://localhost:3001/api/v1/integrations/google/callback'),
    // AI assistance. The key is server-only and is never sent to the browser.
    AI_PROVIDER: z.enum(['openai', 'disabled']).default('disabled'),
    AI_API_KEY: z.string().default(''),
    AI_MODEL: z.string().trim().min(1).default('gpt-4o-mini'),
    AI_API_BASE_URL: z
      .string()
      .url()
      .default('https://api.openai.com/v1')
      .refine((value: string) => value.startsWith('https://'), {
        message: 'AI_API_BASE_URL must use HTTPS.',
      }),
    RAZORPAY_KEY_ID: z.string().default(''),
    RAZORPAY_KEY_SECRET: z.string().default(''),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  })
  .superRefine((config, context) => {
    if (config.AUTH_SESSION_SAME_SITE === 'none' && config.NODE_ENV !== 'production') {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_SESSION_SAME_SITE'],
        message: 'SameSite=None is only valid in production where Secure cookies are enabled.',
      });
    }
  });

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): ApiEnvironment {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const message = result.error.issues
      .map(
        (issue: { path: PropertyKey[]; message: string }) =>
          `${issue.path.join('.') || 'environment'}: ${issue.message}`,
      )
      .join('; ');
    throw new Error(`Invalid API environment configuration: ${message}`);
  }

  return result.data;
}

export function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes('*')) {
    throw new Error('CORS_ORIGINS cannot contain * when credentials are enabled.');
  }

  return origins;
}
