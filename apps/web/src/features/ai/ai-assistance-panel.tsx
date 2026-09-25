'use client';

import { useState } from 'react';
import { Alert, Button, Card, Loading } from '@campus-skill-exchange/ui';
import type { AiAssistAction } from '@campus-skill-exchange/contracts';
import { requestAiAssist } from './ai-api';

const ACTIONS: { value: AiAssistAction; label: string; hint: string }[] = [
  {
    value: 'explain_match',
    label: 'Explain a match',
    hint: 'Why two people could benefit from each other.',
  },
  {
    value: 'session_topics',
    label: 'Suggest session topics',
    hint: 'Topics to cover in a skill session.',
  },
  { value: 'session_agenda', label: 'Draft a session agenda', hint: 'A short, time-ordered plan.' },
  {
    value: 'draft_message',
    label: 'Draft a message',
    hint: 'A polite message you can edit and send.',
  },
  { value: 'summarize', label: 'Summarise notes', hint: 'A concise summary of your own notes.' },
];

type Stage = 'idle' | 'loading' | 'done' | 'unavailable' | 'error';

export function AiAssistancePanel() {
  const [action, setAction] = useState<AiAssistAction>('session_topics');
  const [context, setContext] = useState('');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  // The draft is always editable, and the user decides whether to keep it.
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const active = ACTIONS.find((item) => item.value === action);
  const canSubmit = context.trim().length >= 3 && stage !== 'loading';

  async function generate() {
    if (!canSubmit) return;
    setStage('loading');
    setError(null);
    setCopied(false);
    try {
      const result = await requestAiAssist({
        action,
        context: context.trim(),
        ...(notes.trim() ? { additionalNotes: notes.trim() } : {}),
      });
      if (result.unavailable || !result.content) {
        setDraft('');
        setModel(null);
        setStage('unavailable');
        return;
      }
      setDraft(result.content);
      setModel(result.model);
      setStage('done');
    } catch {
      setStage('error');
      setError('AI assistance is unavailable right now. Please try again.');
    }
  }

  return (
    <Card
      title="AI assistance"
      description="A small helper for your own notes. It never looks up other people or records for you."
    >
      <div className="ai-form">
        <div className="ai-form__actions" role="group" aria-label="Assistance action">
          {ACTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`ai-chip${action === item.value ? ' ai-chip--active' : ''}`}
              aria-pressed={action === item.value}
              onClick={() => setAction(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {active && <p className="ai-hint">{active.hint}</p>}

        <label className="ai-field">
          <span className="cse-field__label">Your context</span>
          <textarea
            className="cse-input"
            rows={5}
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Describe the situation in your own words. Only this text is sent."
            disabled={stage === 'loading'}
          />
        </label>

        <label className="ai-field">
          <span className="cse-field__label">Extra notes (optional)</span>
          <textarea
            className="cse-input"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything the assistant should keep in mind."
            disabled={stage === 'loading'}
          />
        </label>

        <Button onClick={() => void generate()} disabled={!canSubmit} loading={stage === 'loading'}>
          {stage === 'loading' ? 'Generating' : 'Generate'}
        </Button>
      </div>

      {stage === 'loading' && <Loading label="Generating a draft" />}

      {stage === 'unavailable' && (
        <Alert severity="warning" title="AI assistance is not available">
          No AI provider is configured for this environment, so nothing can be generated. We will
          not show made-up suggestions.
        </Alert>
      )}

      {stage === 'error' && (
        <Alert severity="error" title="Could not generate">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void generate()}>
            Try again
          </Button>
        </Alert>
      )}

      {stage === 'done' && (
        <div className="ai-result">
          <div className="ai-result__header">
            <strong>Draft</strong>
            {model && <span className="ai-hint">Model: {model}</span>}
          </div>
          <label className="ai-field">
            <span className="cse-field__label">Edit before you use it</span>
            <textarea
              className="cse-input"
              rows={8}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <p className="ai-hint">
            Review this before using it. AI output can be wrong, and it is not a record of anything
            that has actually happened.
          </p>
          <div className="ai-result__actions">
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard?.writeText(draft);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy draft'}
            </Button>
            <Button variant="ghost" onClick={() => void generate()}>
              Regenerate
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft('');
                setStage('idle');
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
