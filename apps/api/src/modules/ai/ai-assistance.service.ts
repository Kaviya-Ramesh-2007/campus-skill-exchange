import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  aiAssistSchema,
  type AiAssistRequest,
  type AiAssistResponse,
  type AuthUser,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AI_PROVIDER, AiProviderError, type AiProvider } from './ai.provider';

@Injectable()
export class AiAssistanceService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  /**
   * Never throws for a missing provider: an unconfigured provider is a normal,
   * reportable state rather than an error, and it must never produce fake text.
   */
  async assist(actor: AuthUser, input: unknown): Promise<AiAssistResponse> {
    const data = this.parse(aiAssistSchema, input);
    if (!this.provider.isConfigured()) {
      return {
        action: data.action,
        content: '',
        model: this.provider.name,
        unavailable: true,
      };
    }
    try {
      const result = await this.provider.complete({
        action: data.action,
        context: data.context,
        additionalNotes: data.additionalNotes,
      });
      return {
        action: data.action,
        content: result.content,
        model: result.model,
        unavailable: false,
      };
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw new ApiException(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'AI assistance is unavailable right now.',
        );
      }
      throw error;
    }
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success || result.data === undefined) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    }
    return result.data;
  }
}

export type { AiAssistRequest };
