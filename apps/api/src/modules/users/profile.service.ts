import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  createProfileRequestSchema,
  profileUpdatedEventDefinition,
  updateProfileRequestSchema,
  type AuthenticatedIdentity,
  type AuthUser,
  type CreateProfileRequest,
  type EventEnvelope,
  type Profile,
  type ProfileUpdatedEventPayload,
  type UpdateProfileRequest,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AUTHORIZATION_POLICY, type AuthorizationPolicy } from '../../platform/auth/auth-contracts';
import {
  DuplicateProfileError,
  PROFILE_REPOSITORY,
  type CreateProfileInput,
  type ProfileRecord,
  type ProfileRepository,
  type UpdateProfileInput,
} from './users.types';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly repository: ProfileRepository,
    @Inject(AUTHORIZATION_POLICY) private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async getCurrentProfile(userId: string): Promise<Profile> {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) this.throwNotFound();
    return this.toResponse(profile);
  }

  async getPublicProfile(userId: string): Promise<Profile> {
    const profile = await this.repository.findByUserId(userId);
    // Do not reveal whether a private or missing profile exists.
    if (!profile || profile.visibility !== 'PUBLIC') this.throwNotFound();
    return this.toResponse(profile);
  }

  async createProfile(userId: string, request: CreateProfileRequest): Promise<Profile> {
    const input = this.parseCreateRequest(request);
    const existing = await this.repository.findByUserId(userId);
    if (existing) this.throwAlreadyExists();

    try {
      const profile = await this.repository.create(this.toCreateInput(userId, input));
      return this.toResponse(profile);
    } catch (error) {
      if (error instanceof DuplicateProfileError) this.throwAlreadyExists();
      throw error;
    }
  }

  async updateProfile(
    actor: AuthUser,
    targetUserId: string,
    request: UpdateProfileRequest,
  ): Promise<Profile> {
    this.assertCanEdit(actor, targetUserId);
    const input = this.parseUpdateRequest(request);
    const existing = await this.repository.findByUserId(targetUserId);
    if (!existing) this.throwNotFound();

    const event = this.createUpdatedEvent(actor.id, existing, input);
    const profile = await this.repository.updateByUserId(targetUserId, input, event);
    if (!profile) this.throwNotFound();
    return this.toResponse(profile);
  }

  private assertCanEdit(actor: AuthUser, targetUserId: string): void {
    const identity: AuthenticatedIdentity = {
      userId: actor.id,
      issuer: 'local-session',
      subject: actor.id,
      roles: actor.roles,
      claims: {},
    };
    const allowed = this.authorizationPolicy.can({
      request: { identity },
      action: 'update',
      resourceType: 'Profile',
      resourceId: targetUserId,
      ownerUserId: targetUserId,
    });
    if (allowed) return;
    throw new ApiException(403, 'PROFILE_FORBIDDEN', 'You may only edit your own profile.');
  }

  private parseCreateRequest(request: CreateProfileRequest): CreateProfileRequest {
    const result = createProfileRequestSchema.safeParse(request);
    if (!result.success) this.throwInvalidInput();
    return result.data;
  }

  private parseUpdateRequest(request: UpdateProfileRequest): UpdateProfileInput {
    const result = updateProfileRequestSchema.safeParse(request);
    if (!result.success) this.throwInvalidInput();
    return {
      ...(result.data.displayName !== undefined
        ? { publicDisplayName: result.data.displayName }
        : {}),
      ...(result.data.department !== undefined ? { department: result.data.department } : {}),
      ...(result.data.academicYear !== undefined ? { academicYear: result.data.academicYear } : {}),
      ...(result.data.institution !== undefined ? { institution: result.data.institution } : {}),
      ...(result.data.bio !== undefined ? { bio: result.data.bio } : {}),
      ...(result.data.profileImageUrl !== undefined
        ? { profileImageUrl: result.data.profileImageUrl }
        : {}),
      ...(result.data.interests !== undefined
        ? { interests: this.normalizeInterests(result.data.interests) }
        : {}),
      ...(result.data.githubUrl !== undefined ? { githubUrl: result.data.githubUrl } : {}),
      ...(result.data.portfolioUrl !== undefined ? { portfolioUrl: result.data.portfolioUrl } : {}),
      ...(result.data.visibility !== undefined ? { visibility: result.data.visibility } : {}),
    };
  }

  private toCreateInput(userId: string, input: CreateProfileRequest): CreateProfileInput {
    return {
      userId,
      publicDisplayName: input.displayName ?? null,
      department: input.department ?? null,
      academicYear: input.academicYear ?? null,
      institution: input.institution ?? null,
      bio: input.bio ?? null,
      profileImageUrl: input.profileImageUrl ?? null,
      interests: this.normalizeInterests(input.interests),
      githubUrl: input.githubUrl ?? null,
      portfolioUrl: input.portfolioUrl ?? null,
      visibility: input.visibility,
    };
  }

  private normalizeInterests(interests: string[]): string[] {
    const seen = new Set<string>();
    return interests.reduce<string[]>((result, interest) => {
      const normalized = interest.trim().replace(/\s+/g, ' ');
      const key = normalized.toLocaleLowerCase();
      if (!normalized || seen.has(key)) return result;
      seen.add(key);
      result.push(normalized);
      return result;
    }, []);
  }

  private createUpdatedEvent(
    actorId: string,
    profile: ProfileRecord,
    input: UpdateProfileInput,
  ): EventEnvelope<ProfileUpdatedEventPayload> {
    const eventId = randomUUID();
    const payload: ProfileUpdatedEventPayload = {
      profileId: profile.id,
      userId: profile.userId,
      visibility: input.visibility ?? profile.visibility,
      changedFields: Object.keys(input),
    };

    return {
      eventId,
      eventType: profileUpdatedEventDefinition.name,
      version: profileUpdatedEventDefinition.version,
      occurredAt: new Date().toISOString(),
      actorId,
      entityType: 'Profile',
      entityId: profile.id,
      correlationId: null,
      causationId: null,
      idempotencyKey: `profile-updated:${profile.id}:${eventId}`,
      payload,
    };
  }

  private toResponse(profile: ProfileRecord): Profile {
    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.publicDisplayName ?? profile.userDisplayName,
      department: profile.department,
      academicYear: profile.academicYear,
      institution: profile.institution,
      bio: profile.bio,
      profileImageUrl: profile.profileImageUrl,
      interests: profile.interests,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      visibility: profile.visibility,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private throwNotFound(): never {
    throw new ApiException(404, 'PROFILE_NOT_FOUND', 'The requested profile was not found.');
  }

  private throwAlreadyExists(): never {
    throw new ApiException(409, 'PROFILE_ALREADY_EXISTS', 'This user already has a profile.');
  }

  private throwInvalidInput(): never {
    throw new ApiException(400, 'PROFILE_INVALID_INPUT', 'Profile validation failed.');
  }
}
