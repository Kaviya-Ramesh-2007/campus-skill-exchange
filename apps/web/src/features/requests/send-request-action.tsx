'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Modal } from '@campus-skill-exchange/ui';
import type { SessionRequest } from '@campus-skill-exchange/contracts';
import {
  describeRequestError,
  findOutgoingRequest,
  sessionRequestsClient,
  type SessionRequestsClient,
} from './requests-api';

export interface SendRequestActionProps {
  currentUserId: string;
  recipientUserId: string;
  recipientName: string;
  client?: SessionRequestsClient;
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * The single connection action for a public profile. It renders the state of
 * the existing session request between the two Users and, when a new request is
 * allowed, opens a small form for an optional message.
 */
export function SendRequestAction({
  currentUserId,
  recipientUserId,
  recipientName,
  client = sessionRequestsClient,
}: SendRequestActionProps) {
  const [existing, setExisting] = useState<SessionRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRequest = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await client.list();
      setExisting(findOutgoingRequest(page.items, currentUserId, recipientUserId));
    } catch {
      // A failed lookup must not block the action; the API still validates on submit.
      setExisting(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, currentUserId, recipientUserId]);

  useEffect(() => {
    // The request state is read from the authenticated server session on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequest();
  }, [loadRequest]);

  function openForm() {
    setError(null);
    setIsOpen(true);
  }

  function closeForm() {
    setError(null);
    setIsOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await client.create({
        recipientUserId,
        ...(trimmedMessage ? { message: trimmedMessage } : {}),
      });
      // The UI reflects the new state immediately; no page refresh is needed.
      setExisting(created);
      setMessage('');
      setIsOpen(false);
    } catch (requestError) {
      setError(describeRequestError(requestError, 'send'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (existing?.status === 'ACCEPTED') {
    return (
      <p className="send-request__state" role="status">
        <span className="send-request__state-label">Connected</span>
        <span className="send-request__state-detail">
          {recipientName} accepted your session request. You can now plan a session together.
        </span>
      </p>
    );
  }

  if (existing?.status === 'PENDING') {
    return (
      <p className="send-request__state" role="status">
        <span className="send-request__state-label">Request Pending</span>
        <span className="send-request__state-detail">
          {recipientName} has not responded to your session request yet.
        </span>
      </p>
    );
  }

  return (
    <>
      {/* The trigger is replaced by the dialog so only one Send Request action is ever exposed. */}
      {!isOpen && (
        <Button
          variant="primary"
          size="md"
          onClick={openForm}
          loading={isLoading}
          disabled={isLoading}
          aria-haspopup="dialog"
        >
          Send Request
        </Button>
      )}

      <Modal open={isOpen} title={`Send a session request to ${recipientName}`} onClose={closeForm}>
        <form className="send-request-form" onSubmit={handleSubmit} noValidate>
          <p className="send-request-form__intro">
            {existing?.status === 'DECLINED'
              ? `${recipientName} declined your previous request. You can send a new one.`
              : `Ask ${recipientName} to share a skill in a session. Add a message if you want to.`}
          </p>
          <label className="cse-field" htmlFor="send-request-message">
            <span className="cse-field__label">Message (optional)</span>
            <textarea
              id="send-request-message"
              className="cse-input"
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH}
              value={message}
              placeholder="Share what you would like to learn or practise."
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          {error && (
            <Alert severity="error" title="Request not sent">
              {error}
            </Alert>
          )}
          <div className="send-request-form__actions">
            <Button type="submit" loading={isSubmitting}>
              Send Request
            </Button>
            <Button type="button" variant="secondary" onClick={closeForm} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
