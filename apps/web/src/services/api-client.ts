import {
  apiErrorResponseSchema,
  apiSuccessResponseSchema,
  type ApiErrorResponse,
} from '@campus-skill-exchange/contracts';
import { webEnvironment } from '../config/env';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorResponse['error']['code'];
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(status: number, error: ApiErrorResponse['error']) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.meta.requestId;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, query, headers, ...requestInit } = options;
  const baseUrl = webEnvironment.NEXT_PUBLIC_API_BASE_URL;
  const requestUrl = baseUrl.startsWith('http') ? `${baseUrl}${path}` : `${baseUrl}${path}`;
  const url = new URL(requestUrl, 'http://cse.local');
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const fetchUrl = baseUrl.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
  const response = await fetch(fetchUrl, {
    ...requestInit,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(responseBody);
    if (parsedError.success) throw new ApiClientError(response.status, parsedError.data.error);
    throw new ApiClientError(response.status, {
      code: response.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      message: 'The API request failed.',
      meta: { requestId: response.headers.get('x-request-id') ?? 'unknown' },
    });
  }

  const parsedSuccess = apiSuccessResponseSchema.safeParse(responseBody);
  if (!parsedSuccess.success) {
    throw new Error('The API returned an invalid response envelope.');
  }

  return parsedSuccess.data.data as T;
}
