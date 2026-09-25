import { randomUUID } from 'node:crypto';
import type { EventEnvelope, ProfileUpdatedEventPayload } from '@campus-skill-exchange/contracts';
import {
  DuplicateProfileError,
  type CreateProfileInput,
  type ProfileRecord,
  type ProfileRepository,
  type UpdateProfileInput,
} from '../../src/modules/users/users.types';

export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, ProfileRecord>();
  private readonly userDisplayNames = new Map<string, string>();
  private readonly events: EventEnvelope<ProfileUpdatedEventPayload>[] = [];

  setUser(userId: string, displayName: string): void {
    this.userDisplayNames.set(userId, displayName);
  }

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    const profile = this.profiles.get(userId);
    return profile ? this.cloneProfile(profile) : null;
  }

  async create(input: CreateProfileInput): Promise<ProfileRecord> {
    if (this.profiles.has(input.userId)) throw new DuplicateProfileError();
    const now = new Date();
    const profile: ProfileRecord = {
      id: randomUUID(),
      userId: input.userId,
      publicDisplayName: input.publicDisplayName,
      userDisplayName: this.userDisplayNames.get(input.userId) ?? 'User',
      department: input.department,
      academicYear: input.academicYear,
      institution: input.institution,
      bio: input.bio,
      profileImageUrl: input.profileImageUrl,
      interests: [...input.interests],
      githubUrl: input.githubUrl,
      portfolioUrl: input.portfolioUrl,
      visibility: input.visibility,
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.set(input.userId, profile);
    return this.cloneProfile(profile);
  }

  async updateByUserId(
    userId: string,
    input: UpdateProfileInput,
    event: EventEnvelope<ProfileUpdatedEventPayload>,
  ): Promise<ProfileRecord | null> {
    const existing = this.profiles.get(userId);
    if (!existing) return null;
    const profile: ProfileRecord = {
      ...existing,
      ...input,
      interests: input.interests ? [...input.interests] : [...existing.interests],
      updatedAt: new Date(),
    };
    this.profiles.set(userId, profile);
    this.events.push(event);
    return this.cloneProfile(profile);
  }

  getEvents(): EventEnvelope<ProfileUpdatedEventPayload>[] {
    return [...this.events];
  }

  getProfile(userId: string): ProfileRecord | null {
    const profile = this.profiles.get(userId);
    return profile ? this.cloneProfile(profile) : null;
  }

  clear(): void {
    this.profiles.clear();
    this.userDisplayNames.clear();
    this.events.length = 0;
  }

  private cloneProfile(profile: ProfileRecord): ProfileRecord {
    return { ...profile, interests: [...profile.interests] };
  }
}
