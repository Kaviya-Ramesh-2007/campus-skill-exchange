import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistancePanel } from '../src/features/ai/ai-assistance-panel';

const mocks = vi.hoisted(() => ({ requestAiAssist: vi.fn() }));

vi.mock('../src/features/ai/ai-api', () => ({ requestAiAssist: mocks.requestAiAssist }));

function fillContext(value = 'I want to learn advanced Python from a verified peer.') {
  fireEvent.change(screen.getByPlaceholderText(/Describe the situation/), {
    target: { value },
  });
}

describe('AiAssistancePanel', () => {
  beforeEach(() => {
    mocks.requestAiAssist.mockReset();
  });
  afterEach(() => cleanup());

  it('offers only the supported actions and requires context', () => {
    render(<AiAssistancePanel />);
    for (const label of [
      'Explain a match',
      'Suggest session topics',
      'Draft a session agenda',
      'Draft a message',
      'Summarise notes',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  });

  it('shows a clean unavailable state and invents no text', async () => {
    mocks.requestAiAssist.mockResolvedValue({
      action: 'session_topics',
      content: '',
      model: 'openai',
      unavailable: true,
    });
    render(<AiAssistancePanel />);
    fillContext();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByText('AI assistance is not available')).toBeInTheDocument();
    expect(screen.queryByLabelText('Edit before you use it')).not.toBeInTheDocument();
  });

  it('sends the chosen action and context, then shows an editable draft', async () => {
    mocks.requestAiAssist.mockResolvedValue({
      action: 'session_topics',
      content: '1. Recursion\n2. Generators',
      model: 'test-model',
      unavailable: false,
    });
    render(<AiAssistancePanel />);
    fillContext();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() =>
      expect(mocks.requestAiAssist).toHaveBeenCalledWith({
        action: 'session_topics',
        context: 'I want to learn advanced Python from a verified peer.',
      }),
    );
    const editor = await screen.findByLabelText('Edit before you use it');
    expect(editor).toHaveValue('1. Recursion\n2. Generators');
    expect(screen.getByText('Model: test-model')).toBeInTheDocument();

    fireEvent.change(editor, { target: { value: 'Edited by the user' } });
    expect(screen.getByLabelText('Edit before you use it')).toHaveValue('Edited by the user');
  });

  it('shows an error state when the request fails', async () => {
    mocks.requestAiAssist.mockRejectedValue(new Error('boom'));
    render(<AiAssistancePanel />);
    fillContext();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    expect(
      await screen.findByText('AI assistance is unavailable right now. Please try again.'),
    ).toBeInTheDocument();
  });

  it('discards the draft on request', async () => {
    mocks.requestAiAssist.mockResolvedValue({
      action: 'summarize',
      content: 'Some summary.',
      model: 'test-model',
      unavailable: false,
    });
    render(<AiAssistancePanel />);
    fillContext('Session notes about recursion.');
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await screen.findByLabelText('Edit before you use it');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByLabelText('Edit before you use it')).not.toBeInTheDocument();
  });
});
