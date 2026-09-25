import type {
  EventEnvelope,
  ProfileUpdatedEventPayload,
  ProfileVisibility,
} from '@campus-skill-exchange/contracts';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileRecord {
  id: string;
  userId: string;
  publicDisplayName: string | null;
  userDisplayName: string;
  department: string | null;
  academicYear: string | null;
  institution: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  interests: string[];
  githubUrl: string | null;
  portfolioUrl: string | null;
  visibility: ProfileVisibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProfileInput {
  userId: string;
  publicDisplayName: string | null;
  department: string | null;
  academicYear: string | null;
  institution: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  interests: string[];
  githubUrl: string | null;
  portfolioUrl: string | null;
  visibility: ProfileVisibility;
}

export interface UpdateProfileInput {
  publicDisplayName?: string | null;
  department?: string | null;
  academicYear?: string | null;
  institution?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  interests?: string[];
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  visibility?: ProfileVisibility;
}

export interface ProfileRepository {
  findByUserId(userId: string): Promise<ProfileRecord | null>;
  create(input: CreateProfileInput): Promise<ProfileRecord>;
  updateByUserId(
    userId: string,
    input: UpdateProfileInput,
    event: EventEnvelope<ProfileUpdatedEventPayload>,
  ): Promise<ProfileRecord | null>;
}

export class DuplicateProfileError extends Error {
  constructor() {
    super('A profile already exists for this user.');
    this.name = 'DuplicateProfileError';
  }
}
