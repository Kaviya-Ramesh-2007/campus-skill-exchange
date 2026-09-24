import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@campus-skill-exchange/contracts';

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}
