import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateRating,
  EventEnvelope,
  RatingSubmittedEventPayload,
} from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import {
  DuplicateRatingError,
  RatingParticipantError,
  RatingSelfError,
  RatingSessionNotEligibleError,
  type RatingRecord,
  type RatingSessionRecord,
  type RatingsRepository,
} from './ratings.types';

const userSelect = {
  id: true,
  displayName: true,
  profile: { select: { publicDisplayName: true } },
} satisfies Prisma.UserSelect;

const ratingInclude = {
  rater: { select: userSelect },
  ratedUser: { select: userSelect },
} satisfies Prisma.RatingInclude;

type RatingWithRelations = Prisma.RatingGetPayload<{ include: typeof ratingInclude }>;

@Injectable()
export class PrismaRatingsRepository implements RatingsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async findSession(sessionId: string): Promise<RatingSessionRecord | null> {
    const session = await this.prisma.learningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        host: { select: userSelect },
        participant: { select: userSelect },
      },
    });
    return session ? this.mapSession(session) : null;
  }

  async listForSession(sessionId: string): Promise<RatingRecord[]> {
    const rows = await this.prisma.rating.findMany({
      where: { sessionId },
      include: ratingInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.mapRating(row));
  }

  async create(
    id: string,
    raterUserId: string,
    input: CreateRating,
    event: EventEnvelope<RatingSubmittedEventPayload>,
  ): Promise<RatingRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.learningSession.findUnique({
          where: { id: input.sessionId },
          select: { id: true, status: true, hostUserId: true, participantUserId: true },
        });
        if (!session || session.status !== 'COMPLETED') {
          throw new RatingSessionNotEligibleError();
        }
        if (raterUserId !== session.hostUserId && raterUserId !== session.participantUserId) {
          throw new RatingParticipantError();
        }
        const ratedUserId =
          raterUserId === session.hostUserId ? session.participantUserId : session.hostUserId;
        if (ratedUserId === raterUserId) throw new RatingSelfError();
        const duplicate = await tx.rating.findUnique({
          where: { sessionId_raterUserId: { sessionId: input.sessionId, raterUserId } },
          select: { id: true },
        });
        if (duplicate) throw new DuplicateRatingError();
        const row = await tx.rating.create({
          data: {
            id,
            sessionId: input.sessionId,
            raterUserId,
            ratedUserId,
            rating: input.rating,
            feedback: input.feedback ?? null,
          },
          include: ratingInclude,
        });
        await this.outboxWriter.enqueue(event, tx);
        return this.mapRating(row);
      });
    } catch (error) {
      if (error instanceof DuplicateRatingError || this.isUnique(error)) {
        throw new DuplicateRatingError();
      }
      throw error;
    }
  }

  private mapSession(session: {
    id: string;
    status: RatingSessionRecord['status'];
    host: { id: string; displayName: string; profile: { publicDisplayName: string | null } | null };
    participant: {
      id: string;
      displayName: string;
      profile: { publicDisplayName: string | null } | null;
    };
  }): RatingSessionRecord {
    return {
      id: session.id,
      status: session.status,
      host: {
        userId: session.host.id,
        displayName: session.host.profile?.publicDisplayName ?? session.host.displayName,
      },
      participant: {
        userId: session.participant.id,
        displayName:
          session.participant.profile?.publicDisplayName ?? session.participant.displayName,
      },
    };
  }

  private mapRating(row: RatingWithRelations): RatingRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      rater: {
        userId: row.rater.id,
        displayName: row.rater.profile?.publicDisplayName ?? row.rater.displayName,
      },
      ratedUser: {
        userId: row.ratedUser.id,
        displayName: row.ratedUser.profile?.publicDisplayName ?? row.ratedUser.displayName,
      },
      rating: row.rating as RatingRecord['rating'],
      feedback: row.feedback,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private isUnique(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
