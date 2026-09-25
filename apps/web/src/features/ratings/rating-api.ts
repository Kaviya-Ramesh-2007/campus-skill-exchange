import type { SessionStatus } from '@campus-skill-exchange/contracts';

export interface RatingRecord {
  id: string;
  sessionId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  feedback: string | null;
  createdAt: string;
}

export interface SubmitRatingInput {
  sessionId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
}

export interface RatingClient {
  getRating(sessionId: string): Promise<RatingRecord | null>;
  submitRating(input: SubmitRatingInput): Promise<RatingRecord>;
}

/**
 * The Rating API is owned by a later backend prompt. This boundary fails
 * explicitly until that endpoint is implemented; it never fabricates data.
 */
export const unavailableRatingClient: RatingClient = {
  async getRating() {
    return null;
  },
  async submitRating() {
    throw new Error('Rating service is not available yet.');
  },
};

export interface RatingEligibility {
  status: SessionStatus;
}

export function isRatingEligible(status: SessionStatus): boolean {
  return status === 'COMPLETED';
}
