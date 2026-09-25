import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { AiAssistanceService } from '../src/modules/ai/ai-assistance.service';
import { AiProviderError, type AiProvider } from '../src/modules/ai/ai.provider';
import type { AuthUser } from '@campus-skill-exchange/contracts';

const user: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.test',
  displayName: 'Arun',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: '2026-10-01T12:00:00.000Z',
};

class FakeProvider implements AiProvider {
  readonly name = 'openai';
  configured = true;
  fail = false;
  lastInput: { action: string; context: string; additionalNotes?: string } | null = null;

  isConfigured() {
    return this.configured;
  }
  async complete(input: { action: never; context: string; additionalNotes?: string }) {
    this.lastInput = input;
    if (this.fail) throw new AiProviderError('provider down');
    return { content: 'Suggested topics from the supplied context.', model: 'test-model' };
  }
}

function setup() {
  const provider = new FakeProvider();
  return { provider, service: new AiAssistanceService(provider) };
}

describe('AiAssistanceService', () => {
  it('returns real provider content for every supported action', async () => {
    const actions = [
      'explain_match',
      'session_topics',
      'session_agenda',
      'draft_message',
      'summarize',
    ] as const;
    for (const action of actions) {
      const { service } = setup();
      const result = await service.assist(user, {
        action,
        context: 'I want to learn advanced Python from a verified peer.',
      });
      expect(result).toMatchObject({ action, unavailable: false, model: 'test-model' });
      expect(result.content).toBe('Suggested topics from the supplied context.');
    }
  });

  it('passes the Users own context to the provider', async () => {
    const { service, provider } = setup();
    await service.assist(user, {
      action: 'summarize',
      context: 'Session notes about recursion.',
      additionalNotes: 'Keep it short.',
    });
    expect(provider.lastInput).toMatchObject({
      action: 'summarize',
      context: 'Session notes about recursion.',
      additionalNotes: 'Keep it short.',
    });
  });

  it('reports a clean unavailable state with no invented text', async () => {
    const { service, provider } = setup();
    provider.configured = false;
    const result = await service.assist(user, { action: 'summarize', context: 'Some notes here.' });
    expect(result).toMatchObject({ unavailable: true, content: '' });
    expect(provider.lastInput).toBeNull();
  });

  it('never returns fake text when the provider fails', async () => {
    const { service, provider } = setup();
    provider.fail = true;
    await expect(
      service.assist(user, { action: 'draft_message', context: 'Ask about a session.' }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects an unsupported action or empty context', async () => {
    const { service } = setup();
    await expect(
      service.assist(user, { action: 'do_anything', context: 'valid context' }),
    ).rejects.toBeInstanceOf(ApiException);
    await expect(service.assist(user, { action: 'summarize', context: '' })).rejects.toBeInstanceOf(
      ApiException,
    );
  });
});
