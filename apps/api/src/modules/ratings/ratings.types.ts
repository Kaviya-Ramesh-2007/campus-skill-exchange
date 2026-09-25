import type {
  CreateRating,
  EventEnvelope,
  Rating,
  RatingSubmittedEventPayload,
} from '@campus-skill-exchange/contracts';

export const RATINGS_REPOSITORY = Symbol('RATINGS_REPOSITORY');

export type RatingIdentity = Pick<Rating['rater'], 'userId' | 'displayName'>;
export interface RatingSessionRecord {
  id: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  host: RatingIdentity;
  participant: RatingIdentity;
}
export interface RatingRecord {
  id: string;
  sessionId: string;
  rater: RatingIdentity;
  ratedUser: RatingIdentity;
  rating: number;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface RatingsRepository {
  findSession(sessionId: string): Promise<RatingSessionRecord | null>;
  listForSession(sessionId: string): Promise<RatingRecord[]>;
  create(
    id: string,
    raterUserId: string,
    input: CreateRating,
    event: EventEnvelope<RatingSubmittedEventPayload>,
  ): Promise<RatingRecord>;
}
export class DuplicateRatingError extends Error {
  constructor() {
    super('A rating already exists for this rater and session.');
    this.name = 'DuplicateRatingError';
  }
}
export class RatingSessionNotEligibleError extends Error {
  constructor() {
    super('Only completed Sessions can be rated.');
    this.name = 'RatingSessionNotEligibleError';
  }
}
export class RatingParticipantError extends Error {
  constructor() {
    super('Only Session participants can rate or view ratings.');
    this.name = 'RatingParticipantError';
  }
}
export class RatingSelfError extends Error {
  constructor() {
    super('A User cannot rate themselves.');
    this.name = 'RatingSelfError';
  }
}
