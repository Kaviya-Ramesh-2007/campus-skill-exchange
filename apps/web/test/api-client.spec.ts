import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/services/api-client';

describe('API client foundation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps a successful API envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { status: 'ok' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(apiRequest<{ status: string }>('/health')).resolves.toEqual({ status: 'ok' });
  });

  it('maps a structured API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Missing.', meta: { requestId: 'req-1' } },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(apiRequest('/missing')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      requestId: 'req-1',
    });
  });
});
