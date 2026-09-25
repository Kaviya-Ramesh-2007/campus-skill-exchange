import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EventEnvelope, ProfileUpdatedEventPayload } from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import {
  DuplicateProfileError,
  type CreateProfileInput,
  type ProfileRecord,
  type ProfileRepository,
  type UpdateProfileInput,
} from './users.types';

type ProfileWithUser = Prisma.ProfileGetPayload<{
  include: { user: { select: { displayName: true } } };
}>;

@Injectable()
export class PrismaProfileRepository implements ProfileRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { user: { select: { displayName: true } } },
    });
    return profile ? this.mapProfile(profile) : null;
  }

  async create(input: CreateProfileInput): Promise<ProfileRecord> {
    try {
      const profile = await this.prisma.profile.create({
        data: {
          id: randomUUID(),
          userId: input.userId,
          publicDisplayName: input.publicDisplayName,
          department: input.department,
          academicYear: input.academicYear,
          institution: input.institution,
          bio: input.bio,
          profileImageUrl: input.profileImageUrl,
          interests: input.interests,
          githubUrl: input.githubUrl,
          portfolioUrl: input.portfolioUrl,
          visibility: input.visibility,
        },
        include: { user: { select: { displayName: true } } },
      });
      return this.mapProfile(profile);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new DuplicateProfileError();
      throw error;
    }
  }

  async updateByUserId(
    userId: string,
    input: UpdateProfileInput,
    event: EventEnvelope<ProfileUpdatedEventPayload>,
  ): Promise<ProfileRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.profile.findUnique({ where: { userId } });
      if (!existing) return null;

      const profile = await tx.profile.update({
        where: { userId },
        data: input,
        include: { user: { select: { displayName: true } } },
      });
      await this.outboxWriter.enqueue(event, tx);
      return this.mapProfile(profile);
    });
  }

  private mapProfile(profile: ProfileWithUser): ProfileRecord {
    return {
      id: profile.id,
      userId: profile.userId,
      publicDisplayName: profile.publicDisplayName,
      userDisplayName: profile.user.displayName,
      department: profile.department,
      academicYear: profile.academicYear,
      institution: profile.institution,
      bio: profile.bio,
      profileImageUrl: profile.profileImageUrl,
      interests: profile.interests,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      visibility: profile.visibility,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
