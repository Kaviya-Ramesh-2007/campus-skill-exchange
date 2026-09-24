import { describe, expect, it } from 'vitest';
import { parseWebEnvironment } from '../src/config/env';

describe('web environment configuration', () => {
  it('uses a same-origin API path by default', () => {
    expect(parseWebEnvironment({}).NEXT_PUBLIC_API_BASE_URL).toBe('/api/v1');
  });

  it('accepts an HTTP API URL for deployed environments', () => {
    expect(
      parseWebEnvironment({ NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test/api/v1' })
        .NEXT_PUBLIC_API_BASE_URL,
    ).toBe('https://api.example.test/api/v1');
  });

  it('rejects unsupported API URL values', () => {
    expect(() => parseWebEnvironment({ NEXT_PUBLIC_API_BASE_URL: 'ftp://example.test' })).toThrow();
  });
});
