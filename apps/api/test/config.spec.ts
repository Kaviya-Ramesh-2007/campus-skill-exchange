import { describe, expect, it } from 'vitest';
import { parseCorsOrigins, validateEnvironment } from '../src/config/env';

describe('API environment configuration', () => {
  it('parses a valid PostgreSQL configuration', () => {
    const config = validateEnvironment({
      NODE_ENV: 'test',
      PORT: '3001',
      HOST: '127.0.0.1',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/campus?schema=public',
      LOG_LEVEL: 'silent',
      CORS_ORIGINS: 'http://localhost:3000',
    });

    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe('test');
  });

  it('rejects a missing database URL', () => {
    expect(() => validateEnvironment({})).toThrow(/DATABASE_URL/);
  });

  it('requires SameSite=None to be used only in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/campus?schema=public',
        AUTH_SESSION_SAME_SITE: 'none',
      }),
    ).toThrow(/SameSite/);
  });

  it('rejects wildcard credentialed CORS', () => {
    expect(() => parseCorsOrigins('*')).toThrow(/CORS_ORIGINS/);
  });
});
