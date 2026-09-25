import { Inject, Injectable } from '@nestjs/common';
import type {
  AssessmentSubmittedEventPayload,
  CreateAssessment,
  EventEnvelope,
} from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import {
  AssessmentNotEligibleError,
  AssessmentNotFoundError,
  AssessmentParticipantError,
  AssessmentSelfError,
  AssessmentSkillMismatchError,
  DuplicateAssessmentError,
  type AssessmentRecord,
  type AssessmentSessionRecord,
  type AssessmentsRepository,
} from './assessments.types';

const userSelect = {
  id: true,
  displayName: true,
  profile: { select: { publicDisplayName: true } },
} satisfies Prisma.UserSelect;
const skillSelect = { id: true, name: true } satisfies Prisma.SkillSelect;
const assessmentInclude = {
  assessor: { select: userSelect },
  assessedUser: { select: userSelect },
  skill: { select: skillSelect },
} satisfies Prisma.AssessmentInclude;
type AssessmentWithRelations = Prisma.AssessmentGetPayload<{ include: typeof assessmentInclude }>;

@Injectable()
export class PrismaAssessmentsRepository implements AssessmentsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async findSession(sessionId: string): Promise<AssessmentSessionRecord | null> {
    const row = await this.prisma.learningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        hostUserId: true,
        participantUserId: true,
        skillId: true,
        host: { select: userSelect },
        participant: { select: userSelect },
      },
    });
    return row ? this.mapSession(row) : null;
  }

  async listForUser(userId: string): Promise<AssessmentRecord[]> {
    const rows = await this.prisma.assessment.findMany({
      where: { assessedUserId: userId },
      include: assessmentInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.mapAssessment(row));
  }

  async listForSession(sessionId: string): Promise<AssessmentRecord[]> {
    const rows = await this.prisma.assessment.findMany({
      where: { sessionId },
      include: assessmentInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.mapAssessment(row));
  }

  async create(
    id: string,
    assessorUserId: string,
    input: CreateAssessment,
    event: EventEnvelope<AssessmentSubmittedEventPayload>,
  ): Promise<AssessmentRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.learningSession.findUnique({
          where: { id: input.sessionId },
          select: {
            id: true,
            status: true,
            hostUserId: true,
            participantUserId: true,
            skillId: true,
          },
        });
        if (!session) throw new AssessmentNotFoundError();
        if (session.status !== 'COMPLETED') throw new AssessmentNotEligibleError();
        if (assessorUserId !== session.hostUserId && assessorUserId !== session.participantUserId) {
          throw new AssessmentParticipantError();
        }
        const assessedUserId =
          assessorUserId === session.hostUserId ? session.participantUserId : session.hostUserId;
        if (assessedUserId === assessorUserId) throw new AssessmentSelfError();
        if (input.skillId !== undefined && input.skillId !== session.skillId) {
          throw new AssessmentSkillMismatchError();
        }
        const existing = await tx.assessment.findUnique({
          where: {
            sessionId_assessorUserId_assessedUserId: {
              sessionId: input.sessionId,
              assessorUserId,
              assessedUserId,
            },
          },
          select: { id: true },
        });
        if (existing) throw new DuplicateAssessmentError();
        const row = await tx.assessment.create({
          data: {
            id,
            sessionId: input.sessionId,
            assessorUserId,
            assessedUserId,
            skillId: input.skillId ?? session.skillId,
            understandingScore: input.understandingScore,
            practicalApplicationScore: input.practicalApplicationScore,
            problemSolvingScore: input.problemSolvingScore,
            communicationScore: input.communicationScore,
            reliabilityScore: input.reliabilityScore,
            feedback: input.feedback ?? null,
          },
          include: assessmentInclude,
        });
        await this.outboxWriter.enqueue(event, tx);
        return this.mapAssessment(row);
      });
    } catch (error) {
      if (error instanceof DuplicateAssessmentError || this.isAssessmentUniqueError(error)) {
        throw new DuplicateAssessmentError();
      }
      throw error;
    }
  }

  private mapSession(row: {
    id: string;
    status: AssessmentSessionRecord['status'];
    hostUserId: string;
    participantUserId: string;
    skillId: string | null;
    host: { id: string; displayName: string; profile: { publicDisplayName: string | null } | null };
    participant: {
      id: string;
      displayName: string;
      profile: { publicDisplayName: string | null } | null;
    };
  }): AssessmentSessionRecord {
    return {
      id: row.id,
      status: row.status,
      hostUserId: row.hostUserId,
      participantUserId: row.participantUserId,
      skillId: row.skillId,
      host: {
        userId: row.host.id,
        displayName: row.host.profile?.publicDisplayName ?? row.host.displayName,
      },
      participant: {
        userId: row.participant.id,
        displayName: row.participant.profile?.publicDisplayName ?? row.participant.displayName,
      },
    };
  }

  private mapAssessment(row: AssessmentWithRelations): AssessmentRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      assessor: {
        userId: row.assessor.id,
        displayName: row.assessor.profile?.publicDisplayName ?? row.assessor.displayName,
      },
      assessedUser: {
        userId: row.assessedUser.id,
        displayName: row.assessedUser.profile?.publicDisplayName ?? row.assessedUser.displayName,
      },
      skill: row.skill,
      understandingScore: row.understandingScore,
      practicalApplicationScore: row.practicalApplicationScore,
      problemSolvingScore: row.problemSolvingScore,
      communicationScore: row.communicationScore,
      reliabilityScore: row.reliabilityScore,
      feedback: row.feedback,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private isAssessmentUniqueError(error: unknown): boolean {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'P2002'
    ) {
      return false;
    }
    const target =
      'meta' in error ? (error as { meta?: { target?: unknown } }).meta?.target : undefined;
    if (target === undefined) return true;
    if (Array.isArray(target)) {
      return (
        target.includes('session_id') &&
        target.includes('assessor_user_id') &&
        target.includes('assessed_user_id')
      );
    }
    return (
      typeof target === 'string' &&
      target.includes('assessments_session_id_assessor_user_id_assessed_user_id_key')
    );
  }
}
