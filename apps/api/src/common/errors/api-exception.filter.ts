import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ApiErrorCode } from '@campus-skill-exchange/contracts';
import { AppLogger } from '../../platform/logging/app-logger';

const defaultCodes: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'AUTHENTICATION_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'DEPENDENCY_UNAVAILABLE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

const defaultMessages: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'The request could not be processed.',
  [HttpStatus.UNAUTHORIZED]: 'Authentication is required.',
  [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action.',
  [HttpStatus.NOT_FOUND]: 'The requested resource was not found.',
  [HttpStatus.CONFLICT]: 'The request conflicts with the current resource state.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'A required service is unavailable.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred.',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@Inject(AppLogger) private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const requestId = request.id || randomUUID();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseRecord = this.asRecord(exceptionResponse);
    const code = this.asCode(responseRecord?.code) ?? defaultCodes[status] ?? 'INTERNAL_ERROR';
    const message =
      this.asMessage(responseRecord?.message) ?? defaultMessages[status] ?? defaultMessages[500];
    const details = this.asDetails(responseRecord?.details ?? responseRecord?.message);

    if (status >= 500) {
      this.logger.error(
        { requestId, method: request.method, url: request.url, exception },
        exception instanceof Error ? exception.stack : undefined,
        'ApiExceptionFilter',
      );
    } else {
      this.logger.warn(
        { requestId, method: request.method, url: request.url, code, status },
        'ApiExceptionFilter',
      );
    }

    reply.status(status).send({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        meta: { requestId },
      },
    });
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private asCode(value: unknown): ApiErrorCode | undefined {
    if (typeof value !== 'string') return undefined;
    return value === 'VALIDATION_ERROR' ||
      value === 'BAD_REQUEST' ||
      value === 'AUTHENTICATION_REQUIRED' ||
      value === 'FORBIDDEN' ||
      value === 'NOT_FOUND' ||
      value === 'CONFLICT' ||
      value === 'RATE_LIMITED' ||
      value === 'DEPENDENCY_UNAVAILABLE' ||
      value === 'INTERNAL_ERROR'
      ? value
      : undefined;
  }

  private asMessage(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
      return value.join('; ');
    return undefined;
  }

  private asDetails(value: unknown): Record<string, unknown> | undefined {
    if (Array.isArray(value)) return { issues: value };
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
    return undefined;
  }
}
