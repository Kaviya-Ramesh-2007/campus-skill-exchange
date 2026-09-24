import { runtimeEnvironments, type RuntimeEnvironment } from '@campus-skill-exchange/contracts';

export { runtimeEnvironments };
export type { RuntimeEnvironment };

export const serviceNames = {
  api: 'campus-skill-exchange-api',
  web: 'campus-skill-exchange-web',
} as const;

export function isRuntimeEnvironment(value: string): value is RuntimeEnvironment {
  return runtimeEnvironments.includes(value as RuntimeEnvironment);
}
