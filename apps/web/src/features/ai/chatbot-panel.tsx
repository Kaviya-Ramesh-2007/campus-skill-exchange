'use client';

import { useState } from 'react';
import { Alert, Button, Card, EmptyState, Loading } from '@campus-skill-exchange/ui';
import { sendChatMessage } from './chat-api';

type Role = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

/**
 * The conversation lives only in this component's state. Nothing is persisted
 * and the assistant is never shown a reply the provider did not actually return.
 */
export function ChatbotPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = draft.trim().length > 0 && !sending;

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setMessages((items) => [...items, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setDraft('');
    setError(null);
    setSending(true);
    try {
      const result = await sendChatMessage({ message: text });
      if (result.unavailable || !result.content) {
        setUnavailable(true);
        return;
      }
      setMessages((items) => [
        ...items,
        { id: `a-${Date.now()}`, role: 'assistant', content: result.content },
      ]);
    } catch {
      setError('The assistant is unavailable right now. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function reset() {
    setMessages([]);
    setDraft('');
    setError(null);
    setUnavailable(false);
  }

  return (
    <Card
      title="Assistant"
      description="Ask about skills, learning, matching, and preparing for sessions."
    >
      {messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Ask a question to get started. Press Enter to send, Shift+Enter for a new line."
        />
      ) : (
        <ul className="chat-list" aria-live="polite">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`chat-message chat-message--${message.role}`}
              data-role={message.role}
            >
              <span className="chat-message__role">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <p className="chat-message__content">{message.content}</p>
            </li>
          ))}
          {sending && (
            <li className="chat-message chat-message--assistant" data-role="assistant">
              <span className="chat-message__role">Assistant</span>
              <Loading label="Thinking" />
            </li>
          )}
        </ul>
      )}

      {unavailable && (
        <Alert severity="warning" title="The assistant is not available">
          No AI provider is configured for this environment, so it cannot reply. We will not show
          made-up answers.
        </Alert>
      )}
      {error && (
        <Alert severity="error" title="Could not reach the assistant">
          {error}
        </Alert>
      )}

      <div className="chat-composer">
        <label className="ai-field">
          <span className="cse-field__label">Your message</span>
          <textarea
            className="cse-input"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about a skill, a match, or how to prepare for a session."
            disabled={sending}
          />
        </label>
        <div className="chat-composer__actions">
          <Button onClick={() => void send()} disabled={!canSend} loading={sending}>
            Send
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" onClick={reset} disabled={sending}>
              Clear conversation
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
