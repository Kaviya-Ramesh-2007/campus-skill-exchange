'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, EmptyState, Loading } from '@campus-skill-exchange/ui';
import type { SessionRequest } from '@campus-skill-exchange/contracts';
import {
  describeRequestError,
  sessionRequestsClient,
  type SessionRequestsClient,
  type SessionRequestDecision,
} from './requests-api';

export interface RequestsInboxProps {
  currentUserId: string;
  client?: SessionRequestsClient;
}

const STATUS_TONE: Record<SessionRequest['status'], 'info' | 'success' | 'neutral' | 'danger'> = {
  PENDING: 'info',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'neutral',
};

/**
 * Lists the session requests the current User sent or received using the
 * existing GET /requests contract, and lets the recipient accept or decline an
 * incoming request. The requester can cancel one they sent.
 */
export function RequestsInbox({
  currentUserId,
  client = sessionRequestsClient,
}: RequestsInboxProps) {
  const [requests, setRequests] = useState<SessionRequest[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await client.list();
      setRequests(page.items);
    } catch {
      setError('Unable to load session requests right now.');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    // Requests are read from the authenticated server session on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(request: SessionRequest, status: SessionRequestDecision) {
    setError(null);
    setPendingId(request.id);
    try {
      const updated = await client.decide(request.id, status);
      setRequests((items) =>
        (items ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (requestError) {
      setError(describeRequestError(requestError, 'decide'));
    } finally {
      setPendingId(null);
    }
  }

  if (isLoading) return <Loading label="Loading session requests" />;
  if (error && !requests) {
    return (
      <Alert severity="error" title="Session requests unavailable">
        {error}{' '}
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Try again
        </Button>
      </Alert>
    );
  }
  if (requests && requests.length === 0) {
    return (
      <EmptyState
        title="No session requests yet"
        description="Find a User on Discover and send a session request to get started."
        action={
          <Link className="cse-button cse-button--primary cse-button--md" href="/discover">
            Find skill-sharing partners
          </Link>
        }
      />
    );
  }

  return (
    <div className="content-stack requests-inbox">
      {error && <Alert severity="error">{error}</Alert>}
      <ul className="requests-list" aria-label="Session requests">
        {(requests ?? []).map((request) => {
          const incoming = request.recipient.userId === currentUserId;
          const otherUser = incoming ? request.requester : request.recipient;
          const busy = pendingId === request.id;
          return (
            <li key={request.id}>
              <Card className="request-card">
                <div className="request-card__header">
                  <div>
                    <p className="request-card__direction">
                      {incoming ? 'Incoming request' : 'Request you sent'}
                    </p>
                    <h2 className="request-card__name">
                      <Link href={`/users/${otherUser.userId}/profile`}>{otherUser.displayName}</Link>
                    </h2>
                  </div>
                  <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>
                </div>

                {request.skill && (
                  <p className="request-card__skill">
                    Skill: <strong>{request.skill.name}</strong>
                  </p>
                )}
                {request.message && <p className="request-card__message">{request.message}</p>}

                {request.status === 'PENDING' && (
                  <div className="request-card__actions">
                    {incoming ? (
                      <>
                        <Button
                          size="sm"
                          loading={busy}
                          onClick={() => void decide(request, 'ACCEPTED')}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void decide(request, 'DECLINED')}
                        >
                          Decline
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        onClick={() => void decide(request, 'CANCELLED')}
                      >
                        Cancel request
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
