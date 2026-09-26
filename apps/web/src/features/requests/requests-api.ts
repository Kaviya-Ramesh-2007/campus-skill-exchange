import type {
  CreateSessionRequest,
  SessionRequest,
  SessionRequestStatus,
} from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export interface SessionRequestPage {
  items: SessionRequest[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

/** The transitions the existing PATCH /requests/:requestId contract accepts. */
export type SessionRequestDecision = Extract<
  SessionRequestStatus,
  'ACCEPTED' | 'DECLINED' | 'CANCELLED'
>;

/** The statuses the API treats as an active request, so duplicates are rejected. */
const ACTIVE_STATUSES: SessionRequestStatus[] = ['PENDING', 'ACCEPTED'];

export function listSessionRequests(limit = 50): Promise<SessionRequestPage> {
  return apiRequest<SessionRequestPage>('/requests', { query: { limit } });
}

export function createSessionRequest(input: CreateSessionRequest): Promise<SessionRequest> {
  return apiRequest<SessionRequest>('/requests', { method: 'POST', body: input });
}

export function decideSessionRequest(
  requestId: string,
  status: SessionRequestDecision,
): Promise<SessionRequest> {
  return apiRequest<SessionRequest>(`/requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: { status },
  });
}

/**
 * The API returns both sent and received requests. `findOutgoingRequest` keeps
 * only the requests the current User sent to `recipientUserId`, newest first,
 * so the UI can reflect the state of that one relationship.
 */
export function findOutgoingRequest(
  requests: SessionRequest[],
  currentUserId: string,
  recipientUserId: string,
): SessionRequest | null {
  const outgoing = requests.filter(
    (request) =>
      request.requester.userId === currentUserId && request.recipient.userId === recipientUserId,
  );
  if (outgoing.length === 0) return null;
  const active = outgoing.find((request) => ACTIVE_STATUSES.includes(request.status));
  return active ?? outgoing[0];
}

export function isActiveRequest(request: SessionRequest | null): boolean {
  return request !== null && ACTIVE_STATUSES.includes(request.status);
}

/** Injected into the components so tests never touch the network. */
export interface SessionRequestsClient {
  list: () => Promise<SessionRequestPage>;
  create: (input: CreateSessionRequest) => Promise<SessionRequest>;
  decide: (requestId: string, status: SessionRequestDecision) => Promise<SessionRequest>;
}

export const sessionRequestsClient: SessionRequestsClient = {
  list: () => listSessionRequests(),
  create: (input) => createSessionRequest(input),
  decide: (requestId, status) => decideSessionRequest(requestId, status),
};

/** Turns an API failure into a message that is safe and useful for a User. */
export function describeRequestError(error: unknown, context: 'send' | 'decide'): string {
  const code = (error as { code?: string } | null)?.code;
  const status = (error as { status?: number } | null)?.status;
  if (context === 'send') {
    if (code === 'VALIDATION_ERROR') return 'You cannot send a session request to yourself.';
    if (status === 409 || code === 'CONFLICT') {
      return 'An active session request already exists with this User.';
    }
    if (status === 404) return 'This User is no longer available for session requests.';
  }
  if (status === 403) return 'You cannot change this session request.';
  if (status === 409 || code === 'CONFLICT') {
    return 'This session request was already updated by someone else. Reload to see the latest state.';
  }
  if (status === 404) return 'This session request no longer exists.';
  return context === 'send'
    ? 'Unable to send the session request. Please try again.'
    : 'Unable to update the session request. Please try again.';
}
