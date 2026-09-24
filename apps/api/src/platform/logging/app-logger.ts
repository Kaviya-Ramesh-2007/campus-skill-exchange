import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { type Logger } from 'pino';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.logger = pino({
      level: config.get<string>('LOG_LEVEL') ?? 'info',
      base: { service: 'campus-skill-exchange-api' },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'password',
          'accessToken',
          'refreshToken',
          'clientSecret',
        ],
        censor: '[REDACTED]',
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info({ context: this.context(optionalParams), message: this.message(message) });
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.logger.error({
      context: context ?? this.context([stack]),
      message: this.message(message),
      stack,
    });
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn({ context: this.context(optionalParams), message: this.message(message) });
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug({ context: this.context(optionalParams), message: this.message(message) });
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug({ context: this.context(optionalParams), message: this.message(message) });
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.fatal({ context: this.context(optionalParams), message: this.message(message) });
  }

  private message(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return 'Structured log message';
    }
  }

  private context(params: unknown[]): string | undefined {
    const value = params.find((param): param is string => typeof param === 'string');
    return value;
  }
}
