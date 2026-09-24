import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z
    .string()
    .min(1)
    .default('/api/v1')
    .refine(
      (value: string) => value.startsWith('/') || /^https?:\/\//i.test(value),
      'NEXT_PUBLIC_API_BASE_URL must be a path or an HTTP(S) URL.',
    ),
});

export type WebEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function parseWebEnvironment(environment: Record<string, unknown>): WebEnvironment {
  const result = publicEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    const message = result.error.issues
      .map(
        (issue: { path: PropertyKey[]; message: string }) =>
          `${issue.path.join('.') || 'environment'}: ${issue.message}`,
      )
      .join('; ');
    throw new Error(`Invalid web environment configuration: ${message}`);
  }
  return result.data;
}

export const webEnvironment = parseWebEnvironment({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
