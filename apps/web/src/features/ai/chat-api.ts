import type { AiChatRequest, AiChatResponse } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export function sendChatMessage(input: AiChatRequest): Promise<AiChatResponse> {
  return apiRequest<AiChatResponse>('/ai/chat', { method: 'POST', body: input });
}
