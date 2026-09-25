import type { AiAssistRequest, AiAssistResponse } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export function requestAiAssist(input: AiAssistRequest): Promise<AiAssistResponse> {
  return apiRequest<AiAssistResponse>('/ai/assist', { method: 'POST', body: input });
}
