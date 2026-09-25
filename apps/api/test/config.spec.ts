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

  const productionBase = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:password@db.internal:5432/campus?schema=public',
    CORS_ORIGINS: 'https://campus.example.edu',
    GOOGLE_REDIRECT_URI: 'https://campus.example.edu/api/v1/integrations/google/callback',
  };

  it('accepts a fully configured production environment', () => {
    expect(() => validateEnvironment(productionBase)).not.toThrow();
  });

  it('rejects local CORS origins in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionBase,
        CORS_ORIGINS: 'https://campus.example.edu,http://localhost:3000',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('rejects a localhost Google redirect in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionBase,
        GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/v1/integrations/google/callback',
      }),
    ).toThrow(/GOOGLE_REDIRECT_URI/);
  });

  it('requires an API key when the AI provider is enabled in production', () => {
    expect(() =>
      validateEnvironment({ ...productionBase, AI_PROVIDER: 'openai', AI_API_KEY: '' }),
    ).toThrow(/AI_API_KEY/);
  });

  it('allows production to run with AI explicitly disabled', () => {
    expect(() =>
      validateEnvironment({ ...productionBase, AI_PROVIDER: 'disabled', AI_API_KEY: '' }),
    ).not.toThrow();
  });

  it('does not apply production rules to development', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/campus?schema=public',
        CORS_ORIGINS: 'http://localhost:3000',
      }),
    ).not.toThrow();
  });
});
