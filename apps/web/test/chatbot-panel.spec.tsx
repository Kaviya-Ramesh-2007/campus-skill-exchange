import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatbotPanel } from '../src/features/ai/chatbot-panel';

const mocks = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));

vi.mock('../src/features/ai/chat-api', () => ({ sendChatMessage: mocks.sendChatMessage }));

function type(message: string) {
  fireEvent.change(screen.getByPlaceholderText(/Ask about a skill/), {
    target: { value: message },
  });
}

describe('ChatbotPanel', () => {
  beforeEach(() => {
    mocks.sendChatMessage.mockReset();
  });
  afterEach(() => cleanup());

  it('starts empty and disables Send until a message is typed', () => {
    render(<ChatbotPanel />);
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    type('Hello');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('sends the message and renders the real provider reply', async () => {
    mocks.sendChatMessage.mockResolvedValue({
      content: 'Bring a notebook and pick one topic.',
      model: 'test-model',
      unavailable: false,
    });
    render(<ChatbotPanel />);
    type('How do I prepare?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(mocks.sendChatMessage).toHaveBeenCalledWith({ message: 'How do I prepare?' }),
    );
    expect(await screen.findByText('Bring a notebook and pick one topic.')).toBeInTheDocument();
    // User and assistant messages are visually distinct.
    expect(screen.getByText('How do I prepare?').closest('li')).toHaveAttribute(
      'data-role',
      'user',
    );
    expect(screen.getByText('Bring a notebook and pick one topic.').closest('li')).toHaveAttribute(
      'data-role',
      'assistant',
    );
  });

  it('sends on Enter but not on Shift+Enter', async () => {
    mocks.sendChatMessage.mockResolvedValue({
      content: 'ok',
      model: 'test-model',
      unavailable: false,
    });
    render(<ChatbotPanel />);
    const input = screen.getByPlaceholderText(/Ask about a skill/);

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(mocks.sendChatMessage).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Hello there' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(mocks.sendChatMessage).toHaveBeenCalledWith({ message: 'Hello there' }),
    );
  });

  it('shows the unavailable state without inventing an assistant reply', async () => {
    mocks.sendChatMessage.mockResolvedValue({
      content: '',
      model: 'openai',
      unavailable: true,
    });
    render(<ChatbotPanel />);
    type('Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('The assistant is not available')).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: /Assistant/ })).not.toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    mocks.sendChatMessage.mockRejectedValue(new Error('boom'));
    render(<ChatbotPanel />);
    type('Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('The assistant is unavailable right now. Please try again.'),
    ).toBeInTheDocument();
  });

  it('clears the whole conversation on request', async () => {
    mocks.sendChatMessage.mockResolvedValue({
      content: 'An answer',
      model: 'test-model',
      unavailable: false,
    });
    render(<ChatbotPanel />);
    type('Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('An answer');

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.queryByText('An answer')).not.toBeInTheDocument();
  });
});
