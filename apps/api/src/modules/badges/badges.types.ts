import type { BadgeEarnedEventPayload, EventEnvelope } from '@campus-skill-exchange/contracts';

export const BADGES_REPOSITORY = Symbol('BADGES_REPOSITORY');

export interface CreateBadgeDefinitionInput {
  name: string;
  description: string;
  code: string;
  iconUrl?: string | null;
}

export interface BadgeDefinitionRecord {
  id: string;
  name: string;
  description: string;
  code: string;
  iconUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBadgeRecord {
  id: string;
  userId: string;
  badgeDefinitionId: string;
  awardedAt: Date;
  badgeDefinition: BadgeDefinitionRecord;
}

export interface AwardBadgeResult {
  badge: UserBadgeRecord;
  created: boolean;
}

export interface BadgesRepository {
  createBadgeDefinition(input: CreateBadgeDefinitionInput): Promise<BadgeDefinitionRecord>;
  listDefinitions(): Promise<BadgeDefinitionRecord[]>;
  awardBadge(
    id: string,
    userId: string,
    badgeDefinitionId: string,
    event: EventEnvelope<BadgeEarnedEventPayload>,
    awardedAt?: Date,
  ): Promise<AwardBadgeResult>;
  listForUser(userId: string): Promise<UserBadgeRecord[]>;
}

export class DuplicateBadgeCodeError extends Error {
  constructor() {
    super('A badge definition with this code already exists.');
    this.name = 'DuplicateBadgeCodeError';
  }
}

export class DuplicateUserBadgeError extends Error {
  constructor() {
    super('This User already has the badge.');
    this.name = 'DuplicateUserBadgeError';
  }
}

export class BadgeUserNotFoundError extends Error {
  constructor() {
    super('The badge recipient was not found.');
    this.name = 'BadgeUserNotFoundError';
  }
}

export class BadgeDefinitionNotFoundError extends Error {
  constructor() {
    super('The badge definition was not found.');
    this.name = 'BadgeDefinitionNotFoundError';
  }
}
