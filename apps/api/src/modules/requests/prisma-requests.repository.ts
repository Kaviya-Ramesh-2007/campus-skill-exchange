import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateSessionRequest,
  EventEnvelope,
  SessionRequestEventPayload,
  SessionRequestStatus,
} from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import {
  DuplicateSessionRequestError,
  RequestRecipientNotFoundError,
  RequestSkillNotFoundError,
  type RequestsRepository,
  type SessionRequestListResult,
  type SessionRequestRecord,
} from './requests.types';

const requestInclude = {
  requester: {
    select: {
      id: true,
      displayName: true,
      profile: { select: { publicDisplayName: true } },
    },
  },
  recipient: {
    select: {
      id: true,
      displayName: true,
      profile: { select: { publicDisplayName: true } },
    },
  },
  skill: { select: { id: true, name: true } },
} satisfies Prisma.SessionRequestInclude;

type RequestWithRelations = Prisma.SessionRequestGetPayload<{
  include: typeof requestInclude;
}>;

@Injectable()
export class PrismaRequestsRepository implements RequestsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async findById(id: string): Promise<SessionRequestRecord | null> {
    const row = await this.prisma.sessionRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    return row ? this.mapRequest(row) : null;
  }

  async list(userId: string, page: number, limit: number): Promise<SessionRequestListResult> {
    const where: Prisma.SessionRequestWhereInput = {
      OR: [{ requesterUserId: userId }, { recipientUserId: userId }],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sessionRequest.findMany({
        where,
        include: requestInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sessionRequest.count({ where }),
    ]);
    return { items: rows.map((row) => this.mapRequest(row)), total };
  }

  async create(
    id: string,
    requesterUserId: string,
    input: CreateSessionRequest,
    event: EventEnvelope<SessionRequestEventPayload>,
  ): Promise<SessionRequestRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const recipient = await tx.user.findFirst({
          where: { id: input.recipientUserId, accountStatus: 'ACTIVE' },
          select: { id: true },
        });
        if (!recipient) throw new RequestRecipientNotFoundError();
        if (input.skillId) {
          const skill = await tx.skill.findUnique({
            where: { id: input.skillId },
            select: { id: true },
          });
          if (!skill) throw new RequestSkillNotFoundError();
        }

        const duplicate = await tx.sessionRequest.findFirst({
          where: {
            requesterUserId,
            recipientUserId: input.recipientUserId,
            status: { in: ['PENDING', 'ACCEPTED'] },
            ...(input.skillId ? { skillId: input.skillId } : { skillId: null }),
          },
          select: { id: true },
        });
        if (duplicate) throw new DuplicateSessionRequestError();

        const row = await tx.sessionRequest.create({
          data: {
            id,
            requesterUserId,
            recipientUserId: input.recipientUserId,
            skillId: input.skillId ?? null,
            message: input.message ?? null,
            status: 'PENDING',
          },
          include: requestInclude,
        });
        await this.outboxWriter.enqueue(event, tx);
        return this.mapRequest(row);
      });
    } catch (error) {
      if (error instanceof DuplicateSessionRequestError || this.isUnique(error)) {
        throw new DuplicateSessionRequestError();
      }
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: Exclude<SessionRequestStatus, 'PENDING'>,
    event: EventEnvelope<SessionRequestEventPayload>,
  ): Promise<SessionRequestRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.sessionRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status },
      });
      if (updated.count === 0) return null;
      const row = await tx.sessionRequest.findUnique({ where: { id }, include: requestInclude });
      if (!row) return null;
      await this.outboxWriter.enqueue(event, tx);
      return this.mapRequest(row);
    });
  }

  private mapRequest(row: RequestWithRelations): SessionRequestRecord {
    return {
      id: row.id,
      requester: {
        userId: row.requester.id,
        displayName: row.requester.profile?.publicDisplayName ?? row.requester.displayName,
      },
      recipient: {
        userId: row.recipient.id,
        displayName: row.recipient.profile?.publicDisplayName ?? row.recipient.displayName,
      },
      skill: row.skill ? { id: row.skill.id, name: row.skill.name } : null,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private isUnique(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
