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

export interface BadgesRepository {
  createBadgeDefinition(input: CreateBadgeDefinitionInput): Promise<BadgeDefinitionRecord>;
  awardBadge(userId: string, badgeDefinitionId: string, awardedAt?: Date): Promise<UserBadgeRecord>;
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
